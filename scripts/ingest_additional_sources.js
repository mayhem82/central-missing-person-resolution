const fs=require('fs');
const path=require('path');

const INCIDENT='NEPAL-2026-08-26-FLOOD';
const sources=[
  ['DAO_RASUWA_FLOOD_HUB','data/dao-rasuwa-latest.json','UNKNOWN'],
  ['DAO_RASUWA_BHADRA12_NOTICE','data/dao-rasuwa-bhadra12-latest.json','MISSING'],
  ['DAO_MAKWANPUR_BHADRA13','data/dao-makwanpur-bhadra13-latest.json','UNKNOWN'],
  ['DAO_BANKe_MISSING','data/dao-banke-latest.json','MISSING'],
  ['DAO_PARSA_BHADRA13_MISSING','data/dao-parsa-bhadra13-latest.json','MISSING']
];
const manifest=JSON.parse(fs.readFileSync('data/source-manifest.json','utf8'));
const urlFor=id=>manifest.sources.find(s=>s.id===id)?.url||null;
const strip=s=>s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();
const redact=s=>s.replace(/(?:\+?977[- ]?)?9\d{9}/g,'[contact withheld]').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email withheld]');
function status(t,fallback){const s=t.toLowerCase();if(/मृत|शव|deceased|dead/.test(s))return'FOUND_DEAD';if(/घाइते|injured/.test(s))return'FOUND_INJURED';if(/उद्धार|rescued/.test(s))return'RESCUED';if(/सकुशल|फेला|found|located/.test(s))return'FOUND_SAFE';if(/बेपत्ता|हराएको|सम्पर्कविहीन|सम्पर्क विहीन|missing|out of contact/.test(s))return'MISSING';return fallback;}
function snapshotFiles(id){if(!fs.existsSync('data/source-snapshots'))return[];return fs.readdirSync('data/source-snapshots').filter(f=>f===`${id}.html`||f.startsWith(`${id}-page-`)).sort();}
function parse(id,fallback){const records=[];let n=0;for(const file of snapshotFiles(id)){const html=fs.readFileSync(path.join('data/source-snapshots',file),'utf8');for(const m of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){const text=redact(strip(m[1]));if(text.length<8)continue;if(!/बेपत्ता|हराएको|सम्पर्क|फेला|उद्धार|घाइते|मृत|missing|found|rescued|injured|dead|deceased/i.test(text))continue;records.push({id:`${id}-${String(++n).padStart(5,'0')}`,incident_id:INCIDENT,source:id,status:status(text,fallback),detail:text,source_url:urlFor(id),identity_resolution:'UNRESOLVED_SOURCE_RECORD'});}}return records;}
for(const [id,out,fallback] of sources){const records=parse(id,fallback);const payload={incident_id:INCIDENT,source:id,generated_at:new Date().toISOString(),record_count:records.length,records,notes:['Independent source claims only.','No identity merge is performed.','Public contact details are withheld during normalization.']};fs.writeFileSync(out,JSON.stringify(payload,null,2)+'\n');console.log(id,records.length);}
