const fs=require('fs');
const INCIDENT='NEPAL-2026-08-26-FLOOD';
function json(p,d={}){try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch{return d}}
const snapshot=json('data/source-snapshot-state.json',{sources:[]});
const records=json('data/records.json',{records:[]});
const bodies=json('data/unidentified-bodies.json',{records:[]});
const recon=json('data/reconciliation-candidates.json',{});
const policeMissing=json('data/police-missing-latest.json',{records:[],stale:true});
const policeFound=json('data/police-found-latest.json',{records:[],stale:true});
const policeBodies=json('data/police-bodies-latest.json',{records:[],stale:true});
const byId=Object.fromEntries((snapshot.sources||[]).map(x=>[x.source_id,x]));
const checks=[];
function check(id,pass,blocking,detail){checks.push({id,pass:!!pass,blocking:!!blocking,detail})}
check('SETU_CURRENT',byId.SETU&&!byId.SETU.error&&!byId.SETU.page_failures?.length,true,byId.SETU||'no snapshot state');
check('POLICE_MISSING_CURRENT',byId.POLICE_MISSING&&!byId.POLICE_MISSING.error&&!policeMissing.stale,true,{snapshot:byId.POLICE_MISSING||null,records:policeMissing.records.length,stale:policeMissing.stale});
check('POLICE_FOUND_CURRENT',byId.POLICE_FOUND&&!byId.POLICE_FOUND.error&&!policeFound.stale,true,{snapshot:byId.POLICE_FOUND||null,records:policeFound.records.length,stale:policeFound.stale});
check('POLICE_DISASTER_BODIES_CURRENT',byId.POLICE_DISASTER_BODIES&&!byId.POLICE_DISASTER_BODIES.error&&!policeBodies.stale,true,{snapshot:byId.POLICE_DISASTER_BODIES||null,records:policeBodies.records.length,stale:policeBodies.stale});
check('NATIONAL_LIVE_DATA_NONEMPTY',(records.records||[]).length>0,true,{record_count:(records.records||[]).length});
check('RECONCILIATION_QUEUE_GENERATED',Number.isInteger(recon.candidate_link_count),true,{identity_candidates:recon.candidate_link_count??null,body_review_candidates:recon.body_review_candidate_count??null});
check('NO_AUTOMATIC_DEATH_MATCH',recon.rules?.automatic_death_match===false,true,recon.rules||null);
check('MAKWANPUR_BHADRA13_PERSON_LEVEL_EXTRACTED',fs.existsSync('data/dao-makwanpur-bhadra13-person-records.json'),true,'document(8).pdf must be extracted and row-diffed against Bhadra 12 before this passes');
check('SOURCE_COVERAGE_REVIEWED',false,false,'District/local authority, hospital/rescue, foreign-national and downstream recovery-source coverage still requires explicit closure review.');
const blockers=checks.filter(x=>x.blocking&&!x.pass);
const output={incident_id:INCIDENT,generated_at:new Date().toISOString(),complete:blockers.length===0,blocking_gap_count:blockers.length,blocking_gap_ids:blockers.map(x=>x.id),counts:{live_source_records:(records.records||[]).length,unidentified_body_records:(bodies.records||[]).length,identity_review_candidates:recon.candidate_link_count??0,body_review_candidates:recon.body_review_candidate_count??0},checks};
fs.writeFileSync('data/completeness.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output,null,2));
