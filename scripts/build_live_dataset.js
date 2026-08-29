const fs=require('fs');
const INCIDENT='NEPAL-2026-08-26-FLOOD';
function json(path,fallback={}){try{return JSON.parse(fs.readFileSync(path,'utf8'))}catch{return fallback}}
function read(path){return json(path,{records:[]}).records||[]}
const previousDoc=json('data/records.json',{records:[],dataset_version:null,generated_at:null,source_counts:{},status_counts:{}});
const previous=previousDoc.records||[];
const sets=[
  ['CURATED','data/manual-records.json'],
  ['AUSTRALIAN_PUBLIC_COHORT','data/australian-cohort.json'],
  ['NDRRMA_SETU','data/setu-latest.json'],
  ['OPMCM_RESCUE_PORTAL','data/opmcm-latest.json'],
  ['NEPAL_POLICE_MISSING','data/police-missing-latest.json'],
  ['NEPAL_POLICE_FOUND','data/police-found-latest.json'],
  ['DAO_RASUWA_FLOOD_HUB','data/dao-rasuwa-latest.json'],
  ['DAO_RASUWA_BHADRA12_NOTICE','data/dao-rasuwa-bhadra12-latest.json'],
  ['DAO_MAKWANPUR_BHADRA13','data/dao-makwanpur-bhadra13-latest.json'],
  ['DAO_BANKE_MISSING','data/dao-banke-latest.json'],
  ['DAO_PARSA_BHADRA13_MISSING','data/dao-parsa-bhadra13-latest.json']
];
let records=[];const source_counts={};
for(const [source,file] of sets){const rows=read(file);source_counts[source]=rows.length;for(const r of rows)records.push({...r,incident_id:INCIDENT,source:r.source||source});}
const bodies=read('data/police-bodies-latest.json').map(r=>({...r,incident_id:INCIDENT,status:'UNIDENTIFIED_BODY'}));
records.sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'en',{sensitivity:'base'})||String(a.id||'').localeCompare(String(b.id||'')));
const status_counts={};records.forEach(r=>status_counts[r.status]=(status_counts[r.status]||0)+1);
const name_groups={};for(const r of records){const k=String(r.name||'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();if(!k)continue;(name_groups[k]??=[]).push(r.id)}
const collisions=Object.entries(name_groups).filter(([,ids])=>ids.length>1).map(([normalized_name,record_ids])=>({normalized_name,record_ids,warning:'Same/similar source-record name is not proof of same person.'}));
const generated_at=new Date().toISOString();
const run_id=process.env.GITHUB_RUN_ID||null;
const run_number=process.env.GITHUB_RUN_NUMBER||null;
const run_attempt=process.env.GITHUB_RUN_ATTEMPT||null;
const trigger_sha=process.env.GITHUB_SHA||null;
const dataset_version=run_number?`SW-${run_number}${run_attempt&&run_attempt!=='1'?'.'+run_attempt:''}`:`LOCAL-${generated_at.replace(/[-:.TZ]/g,'').slice(0,14)}`;
const version={dataset_version,generated_at,source_watch_run_id:run_id,source_watch_run_number:run_number,source_watch_run_attempt:run_attempt,trigger_commit_sha:trigger_sha,repository:'mayhem82/central-missing-person-resolution',history_url:'https://github.com/mayhem82/central-missing-person-resolution/commits/main'};

const ignored=new Set(['captured_at','fetched_at','generated_at','dataset_version','source_watch_run_id','source_watch_run_number','source_watch_run_attempt','trigger_commit_sha']);
function comparable(r){const o={};for(const k of Object.keys(r||{}).sort())if(!ignored.has(k))o[k]=r[k];return o}
function changedFields(a,b){const keys=[...new Set([...Object.keys(a||{}),...Object.keys(b||{})])].filter(k=>!ignored.has(k)).sort();return keys.filter(k=>JSON.stringify(a?.[k]??null)!==JSON.stringify(b?.[k]??null))}
const before=new Map(previous.filter(r=>r&&r.id).map(r=>[String(r.id),r]));
const after=new Map(records.filter(r=>r&&r.id).map(r=>[String(r.id),r]));
const changes=[];
for(const [id,r] of after){if(!before.has(id)){changes.push({type:'ADDED',id,name:r.name_en||r.name||null,source:r.source||null,status:r.status||null});continue}const old=before.get(id);if(JSON.stringify(comparable(old))!==JSON.stringify(comparable(r))){const fields=changedFields(old,r);changes.push({type:'UPDATED',id,name:r.name_en||r.name||old.name_en||old.name||null,source:r.source||old.source||null,from_status:old.status||null,to_status:r.status||null,changed_fields:fields});}}
for(const [id,r] of before)if(!after.has(id))changes.push({type:'REMOVED',id,name:r.name_en||r.name||null,source:r.source||null,status:r.status||null});
const source_keys=[...new Set([...Object.keys(previousDoc.source_counts||{}),...Object.keys(source_counts)])].sort();
const source_deltas=source_keys.map(source=>({source,before:previousDoc.source_counts?.[source]||0,after:source_counts[source]||0,delta:(source_counts[source]||0)-(previousDoc.source_counts?.[source]||0)})).filter(x=>x.delta!==0);
const status_keys=[...new Set([...Object.keys(previousDoc.status_counts||{}),...Object.keys(status_counts)])].sort();
const status_deltas=status_keys.map(status=>({status,before:previousDoc.status_counts?.[status]||0,after:status_counts[status]||0,delta:(status_counts[status]||0)-(previousDoc.status_counts?.[status]||0)})).filter(x=>x.delta!==0);
const change_summary={incident_id:INCIDENT,dataset_version,generated_at,previous_dataset_version:previousDoc.dataset_version||null,previous_generated_at:previousDoc.generated_at||null,person_record_change_count:changes.length,added_count:changes.filter(x=>x.type==='ADDED').length,updated_count:changes.filter(x=>x.type==='UPDATED').length,removed_count:changes.filter(x=>x.type==='REMOVED').length,source_count_deltas:source_deltas,status_count_deltas:status_deltas,changes};

fs.writeFileSync('data/records.json',JSON.stringify({incident_id:INCIDENT,scope:'national',...version,record_count:records.length,source_counts,status_counts,identity_collisions:collisions,records},null,2)+'\n');
fs.writeFileSync('data/unidentified-bodies.json',JSON.stringify({incident_id:INCIDENT,scope:'national',...version,record_count:bodies.length,records:bodies},null,2)+'\n');
fs.writeFileSync('data/update-meta.json',JSON.stringify({incident_id:INCIDENT,...version,record_count:records.length,unidentified_body_record_count:bodies.length,source_counts,status_counts,change_summary:{person_record_change_count:change_summary.person_record_change_count,added_count:change_summary.added_count,updated_count:change_summary.updated_count,removed_count:change_summary.removed_count}},null,2)+'\n');
fs.writeFileSync('data/change-summary.json',JSON.stringify(change_summary,null,2)+'\n');
console.log(JSON.stringify({incident_id:INCIDENT,dataset_version,generated_at,records:records.length,bodies:bodies.length,source_counts,status_counts,identity_collisions:collisions.length,changes:change_summary},null,2));
if(!records.length)process.exitCode=3;
