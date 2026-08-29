const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const dir='data/source-snapshots';
const out='data/setu-latest.json';
const diffOut='data/setu-diff.json';
function decode(s){return String(s||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#039;|&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/\s+/g,' ').trim()}
function grab(chunk,cls){const re=new RegExp(`<[^>]+class=["'][^"']*${cls}[^"']*["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`,'i');const m=chunk.match(re);return m?decode(m[1]):''}
function mapStatus(raw){const x=raw.toLowerCase();if(x.includes('found')&&x.includes('dead'))return'FOUND_DEAD';if(x.includes('found')&&x.includes('injur'))return'FOUND_INJURED';if(x.includes('found')&&x.includes('safe'))return'FOUND_SAFE';if(x.includes('rescued'))return'RESCUED';if(x.includes('missing'))return'MISSING';return'UNKNOWN'}
function parseAG(s){const a=s.match(/Age\s+(\d+)\s+years/i);const sex=s.match(/\b(Male|Female|Other)\b/i);return{age:a?Number(a[1]):null,sex:sex?sex[1][0].toUpperCase()+sex[1].slice(1).toLowerCase():null}}
function sha(s){return crypto.createHash('sha1').update(s).digest('hex').slice(0,14).toUpperCase()}
const files=fs.readdirSync(dir).filter(x=>/^SETU-page-\d+\.html$/.test(x)).sort();
if(!files.length&&fs.existsSync(path.join(dir,'SETU.html')))files.push('SETU.html');
let provisional=[];
for(const file of files){const html=fs.readFileSync(path.join(dir,file),'utf8');const page=Number((file.match(/page-(\d+)/)||[])[1]||1);const parts=html.split(/<div class=["']rl["'] data-i=["']\d+["']>/).slice(1);for(let i=0;i<parts.length;i++){const c=parts[i].split(/<div class=["']rl["'] data-i=/)[0];const name=grab(c,'rl-name');if(!name)continue;const ag=grab(c,'rl-ag');const {age,sex}=parseAG(ag);const statusRaw=grab(c,'pill');const location=grab(c,'rl-loc');const authority=grab(c,'src');const date=grab(c,'when');provisional.push({page,index_on_page:i,name,age,sex,status:mapStatus(statusRaw),raw_status:statusRaw,location,authority_source:authority,source_date:date,source_url:`https://setu.ndrrma.gov.np/admin/recordlist.php?page=${page}`});}}
const occurrence=new Map();
const records=provisional.map(r=>{const identity=[r.name,r.age??'',r.sex??'',r.location,r.authority_source,r.source_date].join('|').toLowerCase();const n=(occurrence.get(identity)||0)+1;occurrence.set(identity,n);const id='SETU-'+sha(identity+'|occurrence:'+n);return{id,source:'NDRRMA_SETU',...r,duplicate_occurrence:n,detail:[r.authority_source,r.source_date].filter(Boolean).join(' · ')}});
records.sort((a,b)=>a.name.localeCompare(b.name,'en',{sensitivity:'base'})||a.id.localeCompare(b.id));
let previous=[];try{previous=JSON.parse(fs.readFileSync(out,'utf8')).records||[]}catch{}
const prev=new Map(previous.map(r=>[r.id,r])),cur=new Map(records.map(r=>[r.id,r]));const changes=[];
for(const [id,r] of cur){if(!prev.has(id)){changes.push({type:'ADDED_RECORD',id,current:r});continue}const old=prev.get(id);for(const f of ['status','name','age','sex','location','authority_source','source_date'])if(JSON.stringify(old[f])!==JSON.stringify(r[f]))changes.push({type:f==='status'?'STATUS_CHANGED':`${f.toUpperCase()}_CHANGED`,id,from:old[f],to:r[f]})}
for(const [id,r] of prev)if(!cur.has(id))changes.push({type:'REMOVED_RECORD',id,previous:r,warning:'Removal is not evidence of safety, rescue, death or resolution.'});
const status_counts={};records.forEach(r=>status_counts[r.status]=(status_counts[r.status]||0)+1);
const payload={incident_id:'NEPAL-RASUWA-2026',source:'NDRRMA Setu Rapid',generated_at:new Date().toISOString(),pages_parsed:files.length,record_count:records.length,status_counts,records};
fs.writeFileSync(out,JSON.stringify(payload,null,2)+'\n');
fs.writeFileSync(diffOut,JSON.stringify({incident_id:'NEPAL-RASUWA-2026',generated_at:payload.generated_at,previous_count:previous.length,current_count:records.length,change_count:changes.length,changes},null,2)+'\n');
console.log(JSON.stringify({pages:files.length,records:records.length,status_counts,changes:changes.length},null,2));
if(!records.length)process.exitCode=3;
