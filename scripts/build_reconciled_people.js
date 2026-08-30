'use strict';
const fs=require('fs');
const crypto=require('crypto');
const INCIDENT='NEPAL-2026-08-26-FLOOD';
function json(path,fallback={}){try{return JSON.parse(fs.readFileSync(path,'utf8'))}catch{return fallback}}
function clean(v){return String(v??'').trim()}
function first(...vs){for(const v of vs){const s=clean(v);if(s)return s}return ''}
function uniq(xs){return [...new Set(xs.filter(Boolean))]}
function statusClass(statuses){
  const s=uniq(statuses);
  if(!s.length)return 'STATUS_UNKNOWN';
  if(s.length===1)return s[0];
  const safe=new Set(['FOUND_SAFE','RECONTACTED','RESCUED','LOCATED']);
  if(s.every(x=>safe.has(x)))return 'LOCATED';
  return 'STATUS_REVIEW_REQUIRED';
}
const recordsDoc=json('data/records.json',{records:[]});
const candidates=json('data/reconciliation-candidates.json',{identity_links:[]});
const records=recordsDoc.records||[];
const parent=new Map(records.map(r=>[String(r.id),String(r.id)]));
function find(x){let p=parent.get(x);if(p===undefined)return null;while(p!==parent.get(p)){parent.set(p,parent.get(parent.get(p)));p=parent.get(p)}return p}
function union(a,b){const ra=find(a),rb=find(b);if(!ra||!rb||ra===rb)return;parent.set(rb,ra)}
const accepted=[];const review=[];
for(const link of candidates.identity_links||[]){
  const noConflicts=!(link.conflicts||[]).length;
  const strong=link.classification==='PROBABLE_MATCH'&&noConflicts;
  if(strong){union(String(link.left_record_id),String(link.right_record_id));accepted.push(link)}
  else review.push(link);
}
const groups=new Map();
for(const r of records){const root=find(String(r.id))||String(r.id);if(!groups.has(root))groups.set(root,[]);groups.get(root).push(r)}
const entities=[];
for(const rows of groups.values()){
  rows.sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  const ids=rows.map(r=>String(r.id));
  const key=ids.join('|');
  const entityId='PERSON-'+crypto.createHash('sha256').update(key).digest('hex').slice(0,16).toUpperCase();
  const statuses=uniq(rows.map(r=>r.status));
  const sources=uniq(rows.map(r=>r.source));
  const locations=uniq(rows.map(r=>first(r.location_en,r.location_romanized,r.location)));
  const districts=uniq(rows.map(r=>first(r.district_en,r.district_romanized,r.district)));
  const municipalities=uniq(rows.map(r=>first(r.municipality_en,r.municipality_romanized,r.municipality)));
  const ages=uniq(rows.map(r=>r.age??r.estimated_age).filter(v=>v!==undefined&&v!==null&&v!==''));
  const namesEn=uniq(rows.map(r=>first(r.name_en,r.name_romanized)).filter(Boolean));
  const namesRaw=uniq(rows.map(r=>r.name).filter(Boolean));
  const detailsEn=uniq(rows.map(r=>first(r.detail_en,r.detail_romanized)).filter(Boolean));
  const detailsRaw=uniq(rows.map(r=>r.detail).filter(Boolean));
  const sourceUrls=uniq(rows.map(r=>r.source_url));
  const status=statusClass(statuses);
  entities.push({
    id:entityId,
    incident_id:INCIDENT,
    reconciliation_state:rows.length>1?'CROSS_SOURCE_RECONCILED':'SINGLE_SOURCE_UNLINKED',
    source_record_count:rows.length,
    source_record_ids:ids,
    sources,
    source:sources.length===1?sources[0]:'MULTIPLE_SOURCES',
    name_en:namesEn[0]||'',
    name:namesEn[0]||namesRaw[0]||'',
    name_variants:uniq([...namesEn,...namesRaw]),
    age:ages.length===1?ages[0]:null,
    age_variants:ages,
    status,
    status_variants:statuses,
    district:districts[0]||'',
    district_variants:districts,
    municipality:municipalities[0]||'',
    municipality_variants:municipalities,
    location:locations[0]||'',
    location_variants:locations,
    detail_en:detailsEn[0]||'',
    detail:detailsEn[0]||detailsRaw[0]||'',
    detail_variants:uniq([...detailsEn,...detailsRaw]),
    source_url:sourceUrls[0]||'',
    source_urls:sourceUrls,
    reconciliation_note:rows.length>1?'Multiple independent source records were linked by deterministic reconciliation rules.':'No sufficiently strong cross-source identity link has yet been established.'
  });
}
entities.sort((a,b)=>String(a.name_en||a.name).localeCompare(String(b.name_en||b.name),'en',{sensitivity:'base'})||a.id.localeCompare(b.id));
const status_counts={};for(const e of entities)status_counts[e.status]=(status_counts[e.status]||0)+1;
const generated_at=new Date().toISOString();
const output={
  incident_id:INCIDENT,
  scope:'national',
  generated_at,
  dataset_version:recordsDoc.dataset_version||null,
  source_watch_run_id:recordsDoc.source_watch_run_id||null,
  source_watch_run_number:recordsDoc.source_watch_run_number||null,
  publication_model:'RECONCILED_PERSON_ENTITIES',
  raw_source_record_count:records.length,
  reconciled_person_count:entities.length,
  cross_source_reconciled_count:entities.filter(e=>e.source_record_count>1).length,
  accepted_identity_link_count:accepted.length,
  review_identity_link_count:review.length,
  rules:{raw_records_are_not_people:true,probable_match_requires_no_conflicts:true,possible_matches_are_not_merged:true,conflicting_matches_are_not_merged:true,automatic_death_match:false},
  status_counts,
  records:entities
};
fs.writeFileSync('data/reconciled-people.json',JSON.stringify(output,null,2)+'\n');
fs.writeFileSync('data/records.json',JSON.stringify(output,null,2)+'\n');
const meta=json('data/update-meta.json',{});
fs.writeFileSync('data/update-meta.json',JSON.stringify({...meta,generated_at,publication_model:output.publication_model,raw_source_record_count:records.length,reconciled_person_count:entities.length,cross_source_reconciled_count:output.cross_source_reconciled_count,accepted_identity_link_count:accepted.length,review_identity_link_count:review.length},null,2)+'\n');
console.log(JSON.stringify({raw_source_records:records.length,reconciled_people:entities.length,cross_source_reconciled:output.cross_source_reconciled_count,accepted_identity_links:accepted.length,review_identity_links:review.length},null,2));
if(!entities.length)process.exitCode=3;
