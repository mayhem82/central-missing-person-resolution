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
function add(bucket,key,id){if(!key||!id)return;(bucket[key]??=[]).push(id)}
function addRecord(r){
  add(personCohorts.nationality,r.nationality,r.id);
  add(personCohorts.connection,r.country_connection||r.connection_country,r.id);
  add(personCohorts.operator,r.group||r.operator||r.tour_operator||r.travel_group,r.id);
  for(const m of (r.cohort_memberships||[])){
    if(!m||!m.type||!m.value)continue;
    if(m.type==='NATIONALITY')add(personCohorts.nationality,m.value,r.id);
    if(m.type==='COUNTRY_CONNECTION')add(personCohorts.connection,m.value,r.id);
    if(m.type==='OPERATOR')add(personCohorts.operator,m.value,r.id);
  }
}
for(const r of live.records||[]) addRecord(r);

// The Australian cohort file is explicitly an Australia-connection cohort. Membership in
// this file means connection to Australia, not necessarily Australian citizenship.
for(const r of australian.records||[]){
  add(personCohorts.connection,'Australia',r.id);
  add(personCohorts.operator,r.group||r.operator||r.tour_operator||r.travel_group,r.id);
  if(r.nationality) add(personCohorts.nationality,r.nationality,r.id);
  for(const m of (r.cohort_memberships||[])){
    if(!m||!m.type||!m.value)continue;
    if(m.type==='NATIONALITY')add(personCohorts.nationality,m.value,r.id);
    if(m.type==='COUNTRY_CONNECTION')add(personCohorts.connection,m.value,r.id);
    if(m.type==='OPERATOR')add(personCohorts.operator,m.value,r.id);
  }
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
    'Person-level cohort filters use explicit record membership or an explicit source-cohort assignment, never free-text inference.',
    'Nationality and country-of-residence/connection are distinct.',
    'Australian-cohort records are assigned to Country connection — Australia unless citizenship is explicitly stated.',
    'A later source claim does not erase an earlier claim; chronology is preserved.'
  ],
  nationality_count:Object.keys(byNationality).length,
  nationality_claims:byNationality,
  operator_claims:operatorClaims,
  aggregate_foreign_claims:aggregateClaims,
  person_level_membership:personCohorts
};
fs.writeFileSync('data/cohort-index.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({nationalities:output.nationality_count,operator_claims:operatorClaims.length,aggregate_claims:aggregateClaims.length,person_records:(live.records||[]).length,australia_connected:(personCohorts.connection.Australia||[]).length},null,2));
