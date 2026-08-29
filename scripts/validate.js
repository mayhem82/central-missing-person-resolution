'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const incidentDir = path.join(root, 'incidents', 'nepal-rasuwa-2026');

function readDirJson(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
}

const records = readDirJson(path.join(incidentDir, 'raw-records'));
const persons = readDirJson(path.join(incidentDir, 'persons'));
const claims = readDirJson(path.join(incidentDir, 'identity-claims'));
const statuses = readDirJson(path.join(incidentDir, 'status-events'));
const conflicts = readDirJson(path.join(incidentDir, 'conflicts'));
const sources = readDirJson(path.join(incidentDir, 'sources'));
const evidence = readDirJson(path.join(incidentDir, 'evidence'));

const errors = [];
const unique = (items, field) => {
  const seen = new Set();
  for (const item of items) {
    if (!item[field]) errors.push(`Missing ${field}`);
    else if (seen.has(item[field])) errors.push(`Duplicate ${field}: ${item[field]}`);
    else seen.add(item[field]);
  }
  return seen;
};

const recordIds = unique(records, 'record_id');
const personIds = unique(persons, 'person_id');
const sourceIds = unique(sources, 'source_id');
unique(claims, 'identity_claim_id');
unique(statuses, 'status_event_id');
unique(conflicts, 'conflict_id');
unique(evidence, 'evidence_id');

for (const r of records) {
  if (!sourceIds.has(r.source_id)) errors.push(`${r.record_id}: unknown source ${r.source_id}`);
}
for (const c of claims) {
  if (!recordIds.has(c.record_id)) errors.push(`${c.identity_claim_id}: unknown record ${c.record_id}`);
  if (!personIds.has(c.person_id)) errors.push(`${c.identity_claim_id}: unknown person ${c.person_id}`);
  if (c.classification === 'CONFIRMED_MATCH') {
    const hard = (c.supporting_fields || []).some(v => [
      'verified-photo', 'government-identifier', 'official-confirmation',
      'family-confirmation', 'shared-phone', 'verified-vehicle-context'
    ].includes(v));
    if (!hard) errors.push(`${c.identity_claim_id}: CONFIRMED_MATCH lacks hard bridge`);
  }
}
for (const s of statuses) {
  if (!recordIds.has(s.record_id)) errors.push(`${s.status_event_id}: unknown record ${s.record_id}`);
  if (!personIds.has(s.person_id)) errors.push(`${s.status_event_id}: unknown person ${s.person_id}`);
}
for (const c of conflicts) {
  for (const rid of c.record_ids || []) if (!recordIds.has(rid)) errors.push(`${c.conflict_id}: unknown record ${rid}`);
}
for (const e of evidence) {
  for (const rid of e.record_ids || []) if (!recordIds.has(rid)) errors.push(`${e.evidence_id}: unknown record ${rid}`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`OK: ${sources.length} sources, ${records.length} raw records, ${persons.length} persons, ${claims.length} identity claims, ${statuses.length} status events, ${conflicts.length} conflicts, ${evidence.length} evidence items.`);
