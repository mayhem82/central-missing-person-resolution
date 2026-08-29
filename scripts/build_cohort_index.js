const fs=require('fs');
const INCIDENT='NEPAL-2026-08-26-FLOOD';
function readJson(path,fallback){try{return JSON.parse(fs.readFileSync(path,'utf8'))}catch{return fallback}}
const cohortRegister=readJson('data/international-cohorts.json',{cohorts:[]});
const live=readJson('data/records.json',{records:[]});
const australian=readJson('data/australian-cohort.json',{records:[]});

const nationalityClaims=cohortRegister.cohorts.filter(c=>c.type==='NATIONALITY');
const operatorClaims=cohortRegister.cohorts.filter(c=>c.type==='TOUR_OPERATOR'||c.type==='TOUR_ORGANISATION');
const aggregateClaims=cohortRegister.cohorts.filter(c=>String(c.type).startsWith('AGGREGATE_'));

const byNationality={};
for(const c of nationalityClaims){
  const k=c.nationality||'UNKNOWN';
  (byNationality[k]??=[]).push(c);
}
for(const arr of Object.values(byNationality)) arr.sort((a,b)=>String(a.as_of||'').localeCompare(String(b.as_of||'')));

const personCohorts={nationality:{},connection:{},operator:{}};
function add(bucket,key,id){if(!key)return;(bucket[key]??=[]).push(id)}
for(const r of live.records||[]){
  add(personCohorts.nationality,r.nationality,r.id);
  add(personCohorts.connection,r.australian_connection,r.id);
  add(personCohorts.operator,r.group||r.operator||r.tour_operator,r.id);
}
for(const r of australian.records||[]){
  add(personCohorts.nationality,r.nationality,r.id);
  add(personCohorts.connection,r.australian_connection,r.id);
  add(personCohorts.operator,r.group,r.id);
}
for(const bucket of Object.values(personCohorts)){
  for(const k of Object.keys(bucket)) bucket[k]=[...new Set(bucket[k])].sort();
}

const output={
  incident_id:INCIDENT,
  generated_at:new Date().toISOString(),
  scope:'international-cohort-index',
  rules:[
    'Cohort claims are source claims, not canonical unique-person totals.',
    'Never sum overlapping nationality, operator, location or aggregate cohorts without reconciliation.',
    'Person-level membership is only included where a source record explicitly carries the relevant field.',
    'Nationality and country-of-residence/connection are distinct.',
    'A later source claim does not erase an earlier claim; chronology is preserved.'
  ],
  nationality_count:Object.keys(byNationality).length,
  nationality_claims:byNationality,
  operator_claims:operatorClaims,
  aggregate_foreign_claims:aggregateClaims,
  person_level_membership:personCohorts
};
fs.writeFileSync('data/cohort-index.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({nationalities:output.nationality_count,operator_claims:operatorClaims.length,aggregate_claims:aggregateClaims.length,person_records:(live.records||[]).length},null,2));
