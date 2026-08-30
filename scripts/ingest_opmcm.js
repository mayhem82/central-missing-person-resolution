const fs=require('fs');
const crypto=require('crypto');

const INCIDENT='NEPAL-2026-08-26-FLOOD';
const BASE='https://rescue.opmcm.gov.np';
const OUT='data/opmcm-latest.json';
const STATE='data/opmcm-crawl-state.json';
const MAX_PAGES=200;
const PAGE_SIZE=100;

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const pick=(o,keys)=>{for(const k of keys){const v=o?.[k];if(v!==undefined&&v!==null&&String(v).trim()!=='')return v;}return null;};
const redact=s=>String(s??'')
  .replace(/(?:\+?977[- .]?)?9\d{9}/g,'[contact withheld]')
  .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email withheld]')
  .replace(/\b[A-Z][0-9A-Z]{5,14}\b/g,m=>/\d/.test(m)?'[identifier withheld]':m)
  .trim();
const normStatus=v=>{const s=String(v??'').toLowerCase();if(/dead|deceased|body|मृत|शव/.test(s))return'FOUND_DEAD';if(/injur|घाइते/.test(s))return'FOUND_INJURED';if(/rescu|उद्धार/.test(s))return'RESCUED';if(/found|safe|located|contacted|reunited|सकुशल|फेला/.test(s))return'FOUND_SAFE';if(/out.?of.?contact|contactless|सम्पर्कविहीन|सम्पर्क विहीन/.test(s))return'OUT_OF_CONTACT';if(/missing|lost|हराएको|बेपत्ता/.test(s))return'MISSING';return'STATUS_UNKNOWN';};
const hash=o=>crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0,20);

async function get(url,accept='*/*'){
  const c=new AbortController();const timer=setTimeout(()=>c.abort(),15000);
  try{const r=await fetch(url,{headers:{'accept':accept,'user-agent':'MAYHEM-evidence-crawler/1.0 (+public-interest incident reconciliation)'},signal:c.signal,redirect:'follow'});const text=await r.text();return {ok:r.ok,status:r.status,url:r.url,ct:r.headers.get('content-type')||'',text};}
  finally{clearTimeout(timer)}
}
function discoverBundle(html){const m=html.match(/<script[^>]+src=["']([^"']+\.js)["']/i);return m?new URL(m[1],BASE).href:null;}
function discoverApiCandidates(js){
  const out=new Set([
    '/api/person-reports','/api/person-reports?limit=100&page=1','/api/person-reports?per_page=100&page=1',
    '/api/person-reports?status=missing&limit=100&page=1','/api/person-reports?status=found&limit=100&page=1',
    '/api/person-lost-found','/api/persons','/api/missing-persons','/api/found-persons'
  ]);
  for(const m of js.matchAll(/["'`](\/?api\/[A-Za-z0-9_?=&${}.\/-]+)["'`]/g)){let p=m[1].replace(/\$\{[^}]+\}/g,'');if(/person|missing|found|report/i.test(p))out.add(p.startsWith('/')?p:'/'+p);}
  for(const m of js.matchAll(/["'`](\/[A-Za-z0-9_?=&${}.\/-]*(?:person|missing|found|report)[A-Za-z0-9_?=&${}.\/-]*)["'`]/gi)){let p=m[1].replace(/\$\{[^}]+\}/g,'');if(p.startsWith('/api/'))out.add(p);}
  return [...out].filter(x=>!/[{}]/.test(x));
}
function arraysIn(x,path='root',out=[]){if(Array.isArray(x)){if(x.length&&x.some(v=>v&&typeof v==='object'&&!Array.isArray(v)))out.push({path,value:x});for(let i=0;i<Math.min(x.length,3);i++)arraysIn(x[i],`${path}[${i}]`,out);}else if(x&&typeof x==='object'){for(const [k,v] of Object.entries(x))arraysIn(v,`${path}.${k}`,out);}return out;}
function scoreArray(a){if(!a.length)return 0;let score=0;for(const o of a.slice(0,20)){if(!o||typeof o!=='object')continue;const keys=Object.keys(o).join(' ').toLowerCase();if(/name/.test(keys))score+=2;if(/status|type/.test(keys))score+=2;if(/location|address|district|last/.test(keys))score++;if(/id|uuid|slug/.test(keys))score++;}return score;}
function extractArray(json){const arr=arraysIn(json).sort((a,b)=>scoreArray(b.value)-scoreArray(a.value)||b.value.length-a.value.length);return arr[0]?.value||[];}
function nextPageInfo(json,arr,page){const total=Number(pick(json,['total','totalCount','total_count','count'])||pick(json?.meta||{},['total','totalCount','total_count'])||0);const pages=Number(pick(json,['totalPages','total_pages','pages','lastPage','last_page'])||pick(json?.meta||{},['totalPages','total_pages','lastPage','last_page'])||0);const next=pick(json,['next','nextPage','next_page','nextPageUrl','next_page_url'])||pick(json?.links||{},['next']);return {total,pages,next,more:Boolean(next)||pages>page||(arr.length>=PAGE_SIZE&&(!total||page*PAGE_SIZE<total))};}
function pageUrl(base,page){const u=new URL(base,BASE);if(u.searchParams.has('page'))u.searchParams.set('page',String(page));else u.searchParams.set('page',String(page));if(!u.searchParams.has('limit')&&!u.searchParams.has('per_page')&&!u.searchParams.has('count'))u.searchParams.set('limit',String(PAGE_SIZE));return u.href;}
function normalize(o,endpoint,index){
  const sourceId=pick(o,['id','_id','uuid','report_id','reportId','slug','code','reference','reference_no']);
  const name=redact(pick(o,['name','full_name','fullName','person_name','personName','name_en','name_np','victim_name','missing_person_name'])||'');
  const rawStatus=pick(o,['status','person_status','personStatus','report_status','reportStatus','type','report_type','reportType','category'])||'';
  const age=pick(o,['age','person_age','personAge']);
  const sex=pick(o,['sex','gender']);
  const district=redact(pick(o,['district','district_name','districtName','home_district'])||'');
  const municipality=redact(pick(o,['municipality','municipality_name','municipalityName','local_level','localLevel'])||'');
  const location=redact(pick(o,['location','last_seen_location','lastSeenLocation','address','place','incident_location','incidentLocation'])||'');
  const nationality=redact(pick(o,['nationality','country','citizenship'])||'');
  const details=redact(pick(o,['detail','details','description','remarks','remark','note','notes','additional_info','additionalInfo'])||'');
  const date=pick(o,['reported_at','reportedAt','created_at','createdAt','updated_at','updatedAt','date','last_seen_at','lastSeenAt']);
  const evidence={name,rawStatus,age,sex,district,municipality,location,nationality,details,date};
  const hasPersonSignal=Boolean(name||age||location||district||nationality) && Boolean(rawStatus||details||name);
  if(!hasPersonSignal)return null;
  const stable=sourceId?String(sourceId):hash(evidence);
  const detailUrl=sourceId?`${BASE}/person-reports/${encodeURIComponent(sourceId)}`:BASE+'/person-lost-found';
  return {
    id:`OPMCM-${stable}`,
    incident_id:INCIDENT,
    source:'OPMCM_RESCUE_PORTAL',
    source_type:'GOVERNMENT_PUBLIC_PORTAL',
    source_record_id:sourceId?String(sourceId):null,
    name:name||'Unidentified / name not supplied',
    age:age===null?null:age,
    sex:sex||null,
    nationality:nationality||null,
    district:district||null,
    municipality:municipality||null,
    location:location||null,
    status:normStatus(`${rawStatus} ${details}`),
    source_status:rawStatus?redact(rawStatus):null,
    detail:details||null,
    reported_at:date||null,
    source_url:detailUrl,
    source_endpoint:endpoint,
    identity_resolution:'UNRESOLVED_SOURCE_RECORD',
    publication_note:'OPMCM public portal claim; reconcile with independent sources before identity/status resolution.'
  };
}

(async()=>{
  const started=new Date().toISOString();const errors=[];const probes=[];const records=[];
  let root,bundleUrl,bundleText='';
  try{root=await get(BASE+'/', 'text/html');if(!root.ok)throw new Error(`root HTTP ${root.status}`);bundleUrl=discoverBundle(root.text);if(bundleUrl){const b=await get(bundleUrl,'application/javascript,text/javascript,*/*');if(b.ok)bundleText=b.text;else errors.push(`bundle ${b.status} ${bundleUrl}`);}else errors.push('No JS bundle URL discovered from root HTML');}
  catch(e){errors.push(`root/bundle: ${e.message}`)}
  const candidates=discoverApiCandidates(bundleText);
  const working=[];
  for(const p of candidates){
    try{const r=await get(new URL(p,BASE).href,'application/json,text/plain,*/*');let json=null;try{json=JSON.parse(r.text)}catch{}const arr=json?extractArray(json):[];const score=scoreArray(arr);probes.push({endpoint:p,http_status:r.status,content_type:r.ct,array_count:arr.length,score});if(r.ok&&json&&arr.length&&score>=3)working.push({endpoint:p,json,arr});}
    catch(e){probes.push({endpoint:p,error:e.message})}
    await sleep(40);
  }
  const seenEndpoints=new Set();
  for(const w of working.sort((a,b)=>scoreArray(b.arr)-scoreArray(a.arr))){
    const base=w.endpoint.replace(/([?&])page=\d+/,'$1page=1');if(seenEndpoints.has(base))continue;seenEndpoints.add(base);
    let page=1,json=w.json,arr=w.arr;
    while(page<=MAX_PAGES){
      for(let i=0;i<arr.length;i++){const n=normalize(arr[i],base,i);if(n)records.push(n);}
      const pi=nextPageInfo(json,arr,page);if(!pi.more)break;page++;
      try{const r=await get(pageUrl(base,page),'application/json,text/plain,*/*');if(!r.ok)break;json=JSON.parse(r.text);arr=extractArray(json);if(!arr.length)break;}catch(e){errors.push(`page ${page} ${base}: ${e.message}`);break;}
      await sleep(60);
    }
  }
  const dedup=new Map();for(const r of records){const k=r.source_record_id?`id:${r.source_record_id}`:`h:${hash([r.name,r.age,r.status,r.location,r.detail])}`;if(!dedup.has(k))dedup.set(k,r);}
  const final=[...dedup.values()];
  const previous=(()=>{try{return JSON.parse(fs.readFileSync(OUT,'utf8'))}catch{return null}})();
  const payload={incident_id:INCIDENT,source:'OPMCM_RESCUE_PORTAL',generated_at:new Date().toISOString(),record_count:final.length,records:final,notes:['Dedicated OPMCM crawler.','Portal API routes are discovered from the live frontend bundle and probed at runtime.','Independent public source claims only; no automatic identity merge.','Phone, email and identifier-like values are redacted from normalized public output.']};
  if(final.length>0){fs.writeFileSync(OUT,JSON.stringify(payload,null,2)+'\n');}
  else if(!previous){fs.writeFileSync(OUT,JSON.stringify(payload,null,2)+'\n');}
  const state={incident_id:INCIDENT,source:'OPMCM_RESCUE_PORTAL',started_at:started,finished_at:new Date().toISOString(),root_http_status:root?.status||null,bundle_url:bundleUrl||null,candidate_endpoints:candidates,working_endpoints:[...seenEndpoints],probe_results:probes,records_extracted:final.length,preserved_previous_dataset:final.length===0&&Boolean(previous),errors};
  fs.writeFileSync(STATE,JSON.stringify(state,null,2)+'\n');
  console.log(`OPMCM dedicated crawl: ${final.length} records; ${seenEndpoints.size} working endpoint family/families; ${errors.length} errors.`);
  if(final.length===0)console.warn('No OPMCM person records extracted; previous published OPMCM dataset preserved if present.');
})().catch(e=>{console.error(e);process.exitCode=1;});
