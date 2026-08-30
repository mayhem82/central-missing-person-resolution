const fs=require('fs');
const path=require('path');

const INCIDENT='NEPAL-2026-08-26-FLOOD';
const SOURCES=[
  {id:'MOFA_NEPAL_2026_08_27',as_of:'2026-08-27',url:'https://www.mofa.gov.np/content/1863/latest-/'},
  {id:'MOFA_NEPAL_2026_08_28',as_of:'2026-08-28',url:'https://mofa.gov.np/content/1864/latest-updates-on-flash-floods--28-august/'}
];

function strip(s){return String(s||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim();}
function safeInt(v){const m=String(v||'').replace(/,/g,'').match(/\d+/);return m?Number(m[0]):null;}
function canonCountry(v){const s=strip(v).replace(/^\d+[.)]?\s*/,'').trim();const map={'USA':'United States','UNITED STATES':'United States','UNITED KINGDOM':'United Kingdom','UK':'United Kingdom','SOUTH KOREA':'South Korea','NEW ZEALAND':'New Zealand','SOUTH AFRICA':'South Africa','SWITZERLAND':'Switzerland'};return map[s.toUpperCase()]||s.replace(/\b\w/g,c=>c.toUpperCase());}
function snapshot(id){const p=path.join('data','source-snapshots',`${id}.html`);return fs.existsSync(p)?fs.readFileSync(p,'utf8'):null;}
function parseRows(html,source){
  const claims=[];
  for(const m of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
    const cells=[...m[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(x=>strip(x[1])).filter(Boolean);
    if(cells.length<3)continue;
    const joined=cells.join(' | ');
    if(/country|no\. of person|still missing|s\.n\./i.test(joined))continue;
    if(/^total\b/i.test(cells[0]))continue;
    let offset=0;
    if(/^\d+[.)]?$/.test(cells[0]))offset=1;
    const country=canonCountry(cells[offset]);
    const total=safeInt(cells[offset+1]);
    const found=safeInt(cells[offset+2]);
    const stillMissing=safeInt(cells[offset+3]);
    if(!country||total===null||found===null||stillMissing===null)continue;
    if(/foreigner|nationality not confirmed/i.test(country))continue;
    claims.push({
      id:`${source.id}-${country.toUpperCase().replace(/[^A-Z0-9]+/g,'-')}`,
      type:'NATIONALITY',
      nationality:country,
      status:'OFFICIAL_COUNTRY_STATUS_CLAIM',
      total_reported:total,
      found_count:found,
      still_missing_count:stillMissing,
      as_of:source.as_of,
      source_name:'Government of Nepal Ministry of Foreign Affairs',
      source_id:source.id,
      source_url:source.url,
      evidence_semantics:'Aggregate country-level source claim only; not a person record and not safe to sum across dates.'
    });
  }
  return claims;
}

const cohorts=[];
const source_health=[];
for(const source of SOURCES){
  const html=snapshot(source.id);
  if(!html){source_health.push({source_id:source.id,available:false,claim_count:0});continue;}
  const claims=parseRows(html,source);
  cohorts.push(...claims);
  source_health.push({source_id:source.id,available:true,claim_count:claims.length});
}

const payload={
  incident_id:INCIDENT,
  generated_at:new Date().toISOString(),
  source_type:'GOVERNMENT_OFFICIAL_AGGREGATE',
  rules:[
    'Each row is a dated Government of Nepal aggregate country claim, not a canonical current total.',
    'Do not convert aggregate counts into synthetic person records.',
    'Do not sum rows across dates.',
    'Found and still-missing are preserved separately.',
    'Person-level nationality still requires person-level evidence.'
  ],
  source_health,
  cohorts
};
fs.writeFileSync('data/mofa-foreign-cohorts.json',JSON.stringify(payload,null,2)+'\n');
console.log(JSON.stringify({sources:source_health,cohort_claims:cohorts.length},null,2));
