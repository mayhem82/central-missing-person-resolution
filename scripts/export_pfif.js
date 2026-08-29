const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

const INPUT='data/records.json';
const POLICY='data/publication-policy.json';
const OUT_DIR='data/interchange';
const OUT_XML=path.join(OUT_DIR,'pfif-1.4.xml');
const OUT_JSON=path.join(OUT_DIR,'pfif-export-manifest.json');
const PFIF_NS='http://zesty.ca/pfif/1.4';
const REPO_URL='https://github.com/mayhem82/central-missing-person-resolution';

function load(p){return JSON.parse(fs.readFileSync(p,'utf8'))}
function xml(s=''){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;')}
function clean(v){if(v===undefined||v===null)return '';return String(v).trim()}
function statusMap(s){const x=clean(s).toUpperCase();if(['FOUND_SAFE','LOCATED','RECONTACTED','RESCUED'].includes(x))return 'is_note_author';if(['MISSING','MISSING_OFFICIALLY_RECORDED','OUT_OF_CONTACT'].includes(x))return 'is_missing';return 'information_sought';}
function personId(r){return `${REPO_URL}/records/${encodeURIComponent(clean(r.id)||crypto.randomUUID())}`}
function redactDetail(s){return clean(s)
  .replace(/\b(?:\+?977[-\s]?)?(?:9[678]\d[-\s]?\d{3}[-\s]?\d{4}|0?\d{1,3}[-\s]?\d{6,8})\b/g,'[contact withheld]')
  .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email withheld]');}
function publicationState(r){return clean(r.publication_state)||'PUBLIC_MINIMISED'}
function publishable(r){return !['WITHHELD','RESTRICTED_INVESTIGATOR'].includes(publicationState(r))}
function field(tag,val,indent='    '){const v=clean(val);return v?`${indent}<pfif:${tag}>${xml(v)}</pfif:${tag}>\n`:''}

const data=load(INPUT);load(POLICY);fs.mkdirSync(OUT_DIR,{recursive:true});
const rows=(data.records||[]).filter(publishable);
let people='';let notes='';let noteCount=0;
for(const r of rows){
  const id=personId(r);
  const now=clean(r.updated_at||r.retrieved_at||r.date||data.generated_at||new Date().toISOString());
  const fullName=clean(r.name);
  const sourceUrl=clean(r.source_url);
  const location=[r.locality,r.municipality,r.district].map(clean).filter(Boolean).join(', ');
  people+='  <pfif:person>\n';
  people+=field('person_record_id',id);
  people+=field('entry_date',now);
  people+=field('author_name','Nepal Disaster Resolution Desk');
  people+=field('author_url',REPO_URL);
  people+=field('source_name',clean(r.source));
  people+=field('source_url',sourceUrl);
  people+=field('full_name',fullName);
  people+=field('age',r.age);
  people+=field('sex',r.sex);
  people+=field('home_city',location);
  people+=field('other',`Incident ${clean(r.incident_id||data.incident_id)}; source record ${clean(r.id)}; publication ${publicationState(r)}. This is a source claim, not a canonical identity determination.`);
  people+='  </pfif:person>\n';
  const detail=redactDetail(r.detail||r.raw_text||'');
  if(clean(r.status)||detail){
    const noteId=`${id}/note/${crypto.createHash('sha1').update(`${clean(r.id)}|${clean(r.status)}|${detail}`).digest('hex').slice(0,16)}`;
    notes+='  <pfif:note>\n';
    notes+=field('note_record_id',noteId);
    notes+=field('person_record_id',id);
    notes+=field('entry_date',now);
    notes+=field('author_name','Nepal Disaster Resolution Desk');
    notes+=field('author_url',REPO_URL);
    notes+=field('source_date',r.date);
    notes+=field('status',statusMap(r.status));
    notes+=field('found',String(['FOUND_SAFE','LOCATED','RECONTACTED','RESCUED','FOUND_INJURED','FOUND_DEAD'].includes(clean(r.status).toUpperCase())));
    notes+=field('text',`Source status: ${clean(r.status)||'UNKNOWN'}${detail?`. ${detail}`:''}`);
    notes+='  </pfif:note>\n';
    noteCount++;
  }
}
const body=`<?xml version="1.0" encoding="UTF-8"?>\n<pfif:pfif xmlns:pfif="${PFIF_NS}">\n${people}${notes}</pfif:pfif>\n`;
fs.writeFileSync(OUT_XML,body);
const manifest={format:'PFIF',version:'1.4',generated_at:new Date().toISOString(),incident_id:data.incident_id,source_record_count:(data.records||[]).length,exported_person_records:rows.length,exported_note_records:noteCount,withheld_records:(data.records||[]).length-rows.length,privacy_policy:'data/publication-policy.json',semantics:['PFIF records are interoperability projections of source claims.','Export does not merge identities or create canonical person determinations.','Sensitive contact information is removed from public notes.','Consequential identity and death determinations remain human-reviewed outside the export layer.']};
fs.writeFileSync(OUT_JSON,JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest,null,2));
