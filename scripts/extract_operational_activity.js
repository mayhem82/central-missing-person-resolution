const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const INCIDENT='NEPAL-2026-08-26-FLOOD';
const manifest=JSON.parse(fs.readFileSync('data/source-manifest.json','utf8'));
const operationalIds=new Set([
  'OPMCM_RESCUE_PORTAL','NRCS_RASUWA_SITREP_2','NRCS_RASUWA_SITREP_3','NRCS_RASUWA_INITIAL_UPDATE','NRCS_RASUWA_RELIEF_UPDATE',
  'IFRC_NEPAL_EMERGENCY_FUNDS','IFRC_NEPAL_EMERGENCY_APPEAL','RADIO_NEPAL_RESPONSE_2026_08_29','RADIO_NEPAL_RASUWA_RESPONSE_2026_08_26',
  'MOFA_NEPAL_2026_08_29_BRIEFING','WHO_NEPAL_RASUWA_2026'
]);
const locs=['Rasuwa','Timure','Rasuwagadhi','Syabrubesi','Syafrubesi','Dhunche','Trishuli','Nuwakot','Bidur','Devighat','Galchhi','Baireni','Muglin','Chitwan','Dhading','Gorkha','Tanahun','Nawalparasi','Kispang','Betrawati','Mailung','Goljung','Gosaikunda','Kathmandu'];
const cats=[
  ['SEARCH_RESCUE',/search|rescue|locate missing|उद्धार|खोज/i],
  ['HUMAN_REMAINS_RECOVERY',/body|bodies|dead body|human remains|recovery|शव/i],
  ['EVACUATION',/evacuat|airlift|helicopter|safe area/i],
  ['ROAD_CLEARANCE',/clear(?:ing|ance)? road|debris removal|mud removal|excavator|loader|backhoe|road obstruction/i],
  ['ACCESS_RESTORATION',/road restored|reconnect|traffic resumed|bridge|bailey/i],
  ['RELIEF_DISTRIBUTION',/relief|food|blanket|drinking water|distribution|ready to eat/i],
  ['FAMILY_TRACING',/restoring family links|family tracing|connect with relatives|help desk/i],
  ['SHELTER_SUPPORT',/shelter|meal management|displaced/i],
  ['INFRASTRUCTURE_ASSESSMENT',/damage assessment|technical team|assessment|electricity|telecommunication|hydropower/i],
  ['WATER_SANITATION_FUEL',/sanitation|drinking water|fuel|wash\b/i],
  ['RISK_MONITORING',/monitoring|early warning|fresh flood|secondary flood|risk alert|lake/i],
  ['FOREIGN_NATIONAL_COORDINATION',/foreign national|embass|consular|tourist/i]
];
const strip=s=>s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();
const safe=s=>s.replace(/[^A-Z0-9_-]/gi,'_');
const observations=[];
for(const src of manifest.sources.filter(s=>operationalIds.has(s.id))){
  const file=`data/source-snapshots/${safe(src.id)}.html`;
  if(!fs.existsSync(file)) continue;
  const text=strip(fs.readFileSync(file,'utf8'));
  const chunks=text.split(/(?<=[.!?])\s+|\s*[•·]\s*|\s{2,}/).map(x=>x.trim()).filter(x=>x.length>=28&&x.length<=700);
  for(const chunk of chunks){
    const categories=cats.filter(([,re])=>re.test(chunk)).map(([c])=>c);
    if(!categories.length) continue;
    const locations=locs.filter(l=>new RegExp(`\\b${l.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'i').test(chunk));
    if(!locations.length) continue;
    const key=[src.id,...locations,...categories,chunk].join('|');
    observations.push({
      id:'AUTO-'+crypto.createHash('sha1').update(key).digest('hex').slice(0,14),
      incident_id:INCIDENT,
      source:src.id,
      source_url:src.url,
      locations,
      categories,
      detail:chunk,
      identity_effect:'NONE_OPERATIONAL_CONTEXT_ONLY'
    });
  }
}
const unique=[...new Map(observations.map(x=>[x.id,x])).values()];
const out={incident_id:INCIDENT,generated_at:new Date().toISOString(),record_count:unique.length,records:unique,rules:['Automatically extracted operational observations are source text fragments and require human interpretation.','They do not prove that a location was exhaustively searched, cleared or resolved.','They must not change person status without person-level evidence.']};
fs.writeFileSync('data/operations-auto.json',JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({operational_observations:unique.length},null,2));
