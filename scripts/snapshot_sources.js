const fs=require('fs');
const crypto=require('crypto');
const path=require('path');
const {execFileSync}=require('child_process');
const manifest=JSON.parse(fs.readFileSync('data/source-manifest.json','utf8'));
const outDir='data/source-snapshots';
fs.mkdirSync(outDir,{recursive:true});
const UA='central-missing-person-resolution/1.4 evidence-snapshot';
const safe=s=>s.replace(/[^A-Z0-9_-]/gi,'_');
const MAX_ROOT_CONCURRENCY=6;
const MAX_PAGE_CONCURRENCY=8;
const FETCH_TIMEOUT_MS=15000;
function isNepalPolice(url){try{return new URL(url).hostname==='udb.nepalpolice.gov.np'}catch{return false}}
function curl(url,insecure=false){const args=['-fsSL','--retry','1','--retry-all-errors','--connect-timeout','8','--max-time','20','-A',UA];if(insecure)args.push('-k');args.push(url);return execFileSync('curl',args,{encoding:'utf8',maxBuffer:60*1024*1024});}
async function fetchText(url){let last='';for(let i=0;i<2;i++){const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),FETCH_TIMEOUT_MS);try{const r=await fetch(url,{redirect:'follow',signal:ctrl.signal,headers:{'user-agent':UA,'accept':'text/html,application/xhtml+xml'}});const body=await r.text();clearTimeout(timer);if(r.status>=200&&r.status<400&&body)return {status:r.status,body,transport:'fetch',tls_verification:'verified'};last=`HTTP ${r.status}`;}catch(e){clearTimeout(timer);last=String(e)} }
  try{const body=curl(url,false);if(body)return {status:200,body,transport:'curl',tls_verification:'verified'};}catch(e){last=`${last}; curl verified: ${e.message}`}
  if(isNepalPolice(url)){try{const body=curl(url,true);if(body)return {status:200,body,transport:'curl-insecure-fallback',tls_verification:'BYPASSED_AFTER_VERIFIED_TLS_FAILURE'};}catch(e){last=`${last}; curl insecure fallback: ${e.message}`}}
  throw new Error(last||'fetch failed');
}
function writeSnapshot(file,body){const p=path.join(outDir,file);const old=fs.existsSync(p)?fs.readFileSync(p,'utf8'):null;const changed=old!==body;fs.writeFileSync(p,body);return {path:p,changed,sha256:crypto.createHash('sha256').update(body).digest('hex'),bytes:Buffer.byteLength(body)};}
function discoverPages(html){const nums=[1];for(const m of html.matchAll(/[?&]page=(\d+)/g))nums.push(Number(m[1]));const max=Math.max(...nums.filter(Number.isFinite));return Math.min(Math.max(max,1),250);}
async function pool(items,limit,worker){const out=new Array(items.length);let next=0;async function run(){while(true){const i=next++;if(i>=items.length)return;out[i]=await worker(items[i],i)}}await Promise.all(Array.from({length:Math.min(limit,items.length)},run));return out;}
async function snapshotSource(s){const started=new Date().toISOString();try{const first=await fetchText(s.url);const base=writeSnapshot(`${safe(s.id)}.html`,first.body);const item={source_id:s.id,critical:!!s.critical,role:s.role||null,url:s.url,retrieved_at:started,http_status:first.status,sha256:base.sha256,bytes:base.bytes,changed:base.changed,error:null,transport:first.transport,tls_verification:first.tls_verification,pages:1,page_failures:[]};
    if(s.pagination==='discover_all'){const maxPage=discoverPages(first.body);item.pages=maxPage;writeSnapshot(`${safe(s.id)}-page-001.html`,first.body);const pages=Array.from({length:Math.max(0,maxPage-1)},(_,i)=>i+2);const results=await pool(pages,MAX_PAGE_CONCURRENCY,async p=>{const u=new URL(s.url);u.searchParams.set('page',String(p));try{const got=await fetchText(u.toString());const snap=writeSnapshot(`${safe(s.id)}-page-${String(p).padStart(3,'0')}.html`,got.body);return {p,ok:true,got,snap};}catch(e){return {p,ok:false,error:String(e)}}});for(const r of results){if(!r.ok){item.page_failures.push({page:r.p,error:r.error});continue}item.changed=item.changed||r.snap.changed;item.bytes+=r.snap.bytes;if(r.got.tls_verification!==item.tls_verification)item.tls_verification='MIXED';}}
    return item;
  }catch(e){return {source_id:s.id,critical:!!s.critical,role:s.role||null,url:s.url,retrieved_at:started,http_status:0,sha256:null,bytes:0,changed:false,error:String(e),pages:0,page_failures:[]}}
}
(async()=>{const state=await pool(manifest.sources,MAX_ROOT_CONCURRENCY,snapshotSource);const generated={generated_at:new Date().toISOString(),sources:state};fs.writeFileSync('data/source-snapshot-state.json',JSON.stringify(generated,null,2)+'\n');console.log(JSON.stringify(generated,null,2));const hard=state.filter(x=>x.critical&&(x.error||x.page_failures.length));if(hard.length){console.error('Critical source failures:',hard.map(x=>x.source_id).join(', '));process.exitCode=2}})();
