const fs=require('fs');const crypto=require('crypto');const path=require('path');
const manifest=JSON.parse(fs.readFileSync('data/source-manifest.json','utf8'));
const outDir='data/source-snapshots';fs.mkdirSync(outDir,{recursive:true});
const safe=s=>s.replace(/[^A-Z0-9_-]/gi,'_');
(async()=>{const state=[];for(const s of manifest.sources){let body='',status=0,error=null;try{const r=await fetch(s.url,{headers:{'user-agent':'central-missing-person-resolution/1.0 evidence-snapshot'}});status=r.status;body=await r.text();}catch(e){error=String(e)}const hash=body?crypto.createHash('sha256').update(body).digest('hex'):null;const p=path.join(outDir,safe(s.id)+'.html');const old=fs.existsSync(p)?fs.readFileSync(p,'utf8'):null;const changed=body&&old!==body;if(body)fs.writeFileSync(p,body);state.push({source_id:s.id,url:s.url,retrieved_at:new Date().toISOString(),http_status:status,sha256:hash,bytes:Buffer.byteLength(body),changed,error});}
fs.writeFileSync('data/source-snapshot-state.json',JSON.stringify({generated_at:new Date().toISOString(),sources:state},null,2)+'\n');
const failures=state.filter(x=>x.error||x.http_status<200||x.http_status>=400);if(failures.length){console.error('Source failures',failures);process.exitCode=2;}else console.log(JSON.stringify(state,null,2));})();
