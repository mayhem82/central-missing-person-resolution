const fs=require('fs');
const crypto=require('crypto');
const path=require('path');
const {execFileSync}=require('child_process');
const manifest=JSON.parse(fs.readFileSync('data/source-manifest.json','utf8'));
const outDir='data/source-snapshots';
fs.mkdirSync(outDir,{recursive:true});
const UA='central-missing-person-resolution/1.1 evidence-snapshot';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const safe=s=>s.replace(/[^A-Z0-9_-]/gi,'_');
async function fetchText(url){
  let last='';
  for(let i=0;i<3;i++){
    try{
      const r=await fetch(url,{redirect:'follow',headers:{'user-agent':UA,'accept':'text/html,application/xhtml+xml'}});
      const body=await r.text();
      if(r.status>=200&&r.status<400&&body) return {status:r.status,body,transport:'fetch'};
      last=`HTTP ${r.status}`;
    }catch(e){last=String(e)}
    await sleep(600*(i+1));
  }
  try{
    const body=execFileSync('curl',['-fsSL','--retry','3','--retry-all-errors','--connect-timeout','15','--max-time','60','-A',UA,url],{encoding:'utf8',maxBuffer:30*1024*1024});
    if(body) return {status:200,body,transport:'curl'};
  }catch(e){last=`${last}; curl: ${e.message}`}
  throw new Error(last||'fetch failed');
}
function writeSnapshot(file,body){
  const p=path.join(outDir,file);
  const old=fs.existsSync(p)?fs.readFileSync(p,'utf8'):null;
  const changed=old!==body;
  fs.writeFileSync(p,body);
  return {path:p,changed,sha256:crypto.createHash('sha256').update(body).digest('hex'),bytes:Buffer.byteLength(body)};
}
function discoverPages(html){
  const nums=[1];
  for(const m of html.matchAll(/[?&]page=(\d+)/g)) nums.push(Number(m[1]));
  const max=Math.max(...nums.filter(Number.isFinite));
  return Math.min(Math.max(max,1),100);
}
(async()=>{
  const state=[];
  for(const s of manifest.sources){
    const started=new Date().toISOString();
    try{
      const first=await fetchText(s.url);
      const base=writeSnapshot(`${safe(s.id)}.html`,first.body);
      const item={source_id:s.id,url:s.url,retrieved_at:started,http_status:first.status,sha256:base.sha256,bytes:base.bytes,changed:base.changed,error:null,transport:first.transport,pages:1,page_failures:[]};
      if(s.pagination==='discover_all'){
        const maxPage=discoverPages(first.body);
        item.pages=maxPage;
        writeSnapshot(`${safe(s.id)}-page-001.html`,first.body);
        for(let p=2;p<=maxPage;p++){
          const u=new URL(s.url);u.searchParams.set('page',String(p));
          try{
            const got=await fetchText(u.toString());
            const snap=writeSnapshot(`${safe(s.id)}-page-${String(p).padStart(3,'0')}.html`,got.body);
            item.changed=item.changed||snap.changed;
            item.bytes+=snap.bytes;
          }catch(e){item.page_failures.push({page:p,error:String(e)})}
          await sleep(120);
        }
      }
      state.push(item);
    }catch(e){state.push({source_id:s.id,url:s.url,retrieved_at:started,http_status:0,sha256:null,bytes:0,changed:false,error:String(e),pages:0,page_failures:[]})}
  }
  const generated={generated_at:new Date().toISOString(),sources:state};
  fs.writeFileSync('data/source-snapshot-state.json',JSON.stringify(generated,null,2)+'\n');
  console.log(JSON.stringify(generated,null,2));
  const hard=state.filter(x=>x.source_id==='SETU'&&(x.error||x.page_failures.length));
  if(hard.length) process.exitCode=2;
})();
