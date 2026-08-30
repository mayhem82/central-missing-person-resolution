const fs=require('fs');
const INCIDENT='NEPAL-2026-08-26-FLOOD';
function read(path){try{return JSON.parse(fs.readFileSync(path,'utf8')).records||[]}catch{return[]}}
function norm(s){return String(s||'').toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu,' ').trim()}
function districtOf(r){return norm(r.district||r.location||'')}
function ageOf(r){const n=Number(r.age??r.estimated_age);return Number.isFinite(n)&&n>0?n:null}
const records=read('data/records.json');
const bodies=read('data/unidentified-bodies.json');
const links=[];

// Index by normalized name so we only compare records that can possibly match.
// This replaces the previous O(n^2) all-record scan, which became a pipeline bottleneck once OPMCM added ~17k records.
const byName=new Map();
for(const r of records){
  const n=norm(r.name);
  if(!n||n==='unknown name') continue;
  if(!byName.has(n)) byName.set(n,[]);
  byName.get(n).push(r);
}
for(const bucket of byName.values()){
  if(bucket.length<2) continue;
  for(let i=0;i<bucket.length;i++) for(let j=i+1;j<bucket.length;j++){
    const a=bucket[i],b=bucket[j];
    if(a.source===b.source) continue;
    const signals=['EXACT_NORMALIZED_NAME'],conflicts=[];
    const aa=ageOf(a),ab=ageOf(b);
    if(aa&&ab){if(aa===ab)signals.push('EXACT_AGE');else conflicts.push('AGE_CONFLICT')}
    const da=districtOf(a),db=districtOf(b);
    if(da&&db){if(da===db||da.includes(db)||db.includes(da))signals.push('DISTRICT_OR_LOCATION_OVERLAP');else conflicts.push('LOCATION_CONFLICT')}
    const sa=String(a.status||''),sb=String(b.status||'');
    if(sa&&sb&&sa!==sb) conflicts.push('STATUS_CONFLICT');
    const strength=signals.includes('EXACT_AGE')&&signals.includes('DISTRICT_OR_LOCATION_OVERLAP')&&!conflicts.includes('AGE_CONFLICT')?'PROBABLE_MATCH':'POSSIBLE_MATCH';
    links.push({id:`LINK-${String(links.length+1).padStart(6,'0')}`,incident_id:INCIDENT,left_record_id:a.id,right_record_id:b.id,classification:conflicts.includes('AGE_CONFLICT')?'CONFLICTING_MATCH':strength,signals,conflicts,automatic_merge:false,human_review_required:true});
  }
}

// Body review candidates are also indexed by age window instead of scanning every body for every person.
const bodiesByAge=new Map();
for(const b of bodies){
  const age=ageOf(b); if(!age) continue;
  if(!bodiesByAge.has(age)) bodiesByAge.set(age,[]);
  bodiesByAge.get(age).push(b);
}
const bodyCandidates=[];
for(const p of records){
  const pa=ageOf(p); if(!pa) continue;
  for(let age=pa-3;age<=pa+3;age++){
    for(const b of bodiesByAge.get(age)||[]){
      const ba=ageOf(b),delta=Math.abs(pa-ba);
      const ps=norm(p.sex),bs=norm(b.sex); if(ps&&bs&&ps!==bs) continue;
      const pd=districtOf(p),bd=districtOf(b);
      const geoOverlap=!!(pd&&bd&&(pd===bd||pd.includes(bd)||bd.includes(pd)));
      bodyCandidates.push({id:`BODY-CAND-${String(bodyCandidates.length+1).padStart(6,'0')}`,incident_id:INCIDENT,person_record_id:p.id,body_record_id:b.id,classification:'REVIEW_ONLY',signals:[`AGE_WITHIN_${delta}_YEARS`,...(ps&&bs?['SEX_COMPATIBLE']:[]),...(geoOverlap?['GEOGRAPHY_OVERLAP']:[])],prohibited_conclusion:'NO_IDENTITY_OR_DEATH_DETERMINATION',human_review_required:true});
    }
  }
}
const output={incident_id:INCIDENT,generated_at:new Date().toISOString(),rules:{name_only_never_confirms:true,automatic_merge:false,automatic_death_match:false},performance_model:{identity_candidate_generation:'NORMALIZED_NAME_INDEX',body_candidate_generation:'AGE_WINDOW_INDEX'},source_record_count:records.length,candidate_link_count:links.length,body_review_candidate_count:bodyCandidates.length,identity_links:links,body_review_candidates:bodyCandidates};
fs.writeFileSync('data/reconciliation-candidates.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({source_records:records.length,name_buckets:byName.size,identity_links:links.length,body_review_candidates:bodyCandidates.length},null,2));
