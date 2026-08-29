const fs=require('fs');
const INCIDENT='NEPAL-2026-08-26-FLOOD';
function read(path){try{return JSON.parse(fs.readFileSync(path,'utf8')).records||[]}catch{return[]}}
const sets=[
  ['NDRRMA_SETU','data/setu-latest.json'],
  ['NEPAL_POLICE_MISSING','data/police-missing-latest.json'],
  ['NEPAL_POLICE_FOUND','data/police-found-latest.json']
];
let records=[];const source_counts={};
for(const [source,file] of sets){const rows=read(file);source_counts[source]=rows.length;for(const r of rows)records.push({...r,incident_id:INCIDENT,source:r.source||source});}
const bodies=read('data/police-bodies-latest.json').map(r=>({...r,incident_id:INCIDENT,status:'UNIDENTIFIED_BODY'}));
records.sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'en',{sensitivity:'base'})||String(a.id||'').localeCompare(String(b.id||'')));
const status_counts={};records.forEach(r=>status_counts[r.status]=(status_counts[r.status]||0)+1);
const name_groups={};for(const r of records){const k=String(r.name||'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();if(!k)continue;(name_groups[k]??=[]).push(r.id)}
const collisions=Object.entries(name_groups).filter(([,ids])=>ids.length>1).map(([normalized_name,record_ids])=>({normalized_name,record_ids,warning:'Same/similar source-record name is not proof of same person.'}));
const generated_at=new Date().toISOString();
fs.writeFileSync('data/records.json',JSON.stringify({incident_id:INCIDENT,scope:'national',generated_at,record_count:records.length,source_counts,status_counts,identity_collisions:collisions,records},null,2)+'\n');
fs.writeFileSync('data/unidentified-bodies.json',JSON.stringify({incident_id:INCIDENT,scope:'national',generated_at,record_count:bodies.length,records:bodies},null,2)+'\n');
console.log(JSON.stringify({incident_id:INCIDENT,records:records.length,bodies:bodies.length,source_counts,status_counts,identity_collisions:collisions.length},null,2));
if(!records.length)process.exitCode=3;
