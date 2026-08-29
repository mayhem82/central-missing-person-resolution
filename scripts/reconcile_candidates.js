const fs=require('fs');
const INCIDENT='NEPAL-2026-08-26-FLOOD';
function read(path){try{return JSON.parse(fs.readFileSync(path,'utf8')).records||[]}catch{return[]}}
function norm(s){return String(s||'').toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu,' ').trim()}
function districtOf(r){return norm(r.district||r.location||'')}
function ageOf(r){const n=Number(r.age??r.estimated_age);return Number.isFinite(n)&&n>0?n:null}
const records=read('data/records.json');
const bodies=read('data/unidentified-bodies.json');
const links=[];
for(let i=0;i<records.length;i++) for(let j=i+1;j<records.length;j++){
  const a=records[i],b=records[j];
  if(a.source===b.source) continue;
  const na=norm(a.name),nb=norm(b.name);
  if(!na||!nb||na==='unknown name'||nb==='unknown name') continue;
  const signals=[],conflicts=[];
  if(na===nb) signals.push('EXACT_NORMALIZED_NAME');
  else continue;
  const aa=ageOf(a),ab=ageOf(b); if(aa&&ab){if(aa===ab)signals.push('EXACT_AGE');else conflicts.push('AGE_CONFLICT')}
  const da=districtOf(a),db=districtOf(b); if(da&&db){if(da===db||da.includes(db)||db.includes(da))signals.push('DISTRICT_OR_LOCATION_OVERLAP');else conflicts.push('LOCATION_CONFLICT')}
  const sa=String(a.status||''),sb=String(b.status||''); if(sa&&sb&&sa!==sb) conflicts.push('STATUS_CONFLICT');
  const strength=signals.includes('EXACT_AGE')&&signals.includes('DISTRICT_OR_LOCATION_OVERLAP')&&!conflicts.includes('AGE_CONFLICT')?'PROBABLE_MATCH':'POSSIBLE_MATCH';
  links.push({id:`LINK-${String(links.length+1).padStart(6,'0')}`,incident_id:INCIDENT,left_record_id:a.id,right_record_id:b.id,classification:conflicts.includes('AGE_CONFLICT')?'CONFLICTING_MATCH':strength,signals,conflicts,automatic_merge:false,human_review_required:true});
}
const bodyCandidates=[];
for(const p of records){
  const pa=ageOf(p); if(!pa) continue;
  for(const b of bodies){
    const ba=ageOf(b); if(!ba) continue;
    const delta=Math.abs(pa-ba); if(delta>3) continue;
    const ps=norm(p.sex),bs=norm(b.sex); if(ps&&bs&&ps!==bs) continue;
    const pd=districtOf(p),bd=districtOf(b);
    const geoOverlap=!!(pd&&bd&&(pd===bd||pd.includes(bd)||bd.includes(pd)));
    bodyCandidates.push({id:`BODY-CAND-${String(bodyCandidates.length+1).padStart(6,'0')}`,incident_id:INCIDENT,person_record_id:p.id,body_record_id:b.id,classification:'REVIEW_ONLY',signals:[`AGE_WITHIN_${delta}_YEARS`,...(ps&&bs?['SEX_COMPATIBLE']:[]),...(geoOverlap?['GEOGRAPHY_OVERLAP']:[])],prohibited_conclusion:'NO_IDENTITY_OR_DEATH_DETERMINATION',human_review_required:true});
  }
}
const output={incident_id:INCIDENT,generated_at:new Date().toISOString(),rules:{name_only_never_confirms:true,automatic_merge:false,automatic_death_match:false},candidate_link_count:links.length,body_review_candidate_count:bodyCandidates.length,identity_links:links,body_review_candidates:bodyCandidates};
fs.writeFileSync('data/reconciliation-candidates.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({identity_links:links.length,body_review_candidates:bodyCandidates.length},null,2));
