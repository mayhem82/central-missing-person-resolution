'use strict';

const { normalizeText, normalizePhone, normalizeRegistration } = require('./normalize');

function detectPairConflicts(a, b) {
  const out = [];
  const an = normalizeText(a.original_name || a.transliteration || '');
  const bn = normalizeText(b.original_name || b.transliteration || '');
  const sameName = an && bn && an === bn;
  if (sameName && a.reported_age != null && b.reported_age != null && a.reported_age !== b.reported_age) {
    out.push('SAME_NAME_DIFFERENT_AGE');
  }
  if (sameName && a.reported_district && b.reported_district && normalizeText(a.reported_district) !== normalizeText(b.reported_district)) {
    out.push('SAME_NAME_DIFFERENT_DISTRICT');
  }
  const ap = new Set((a.reported_phone_numbers || []).map(normalizePhone).filter(Boolean));
  const bp = new Set((b.reported_phone_numbers || []).map(normalizePhone).filter(Boolean));
  if ([...ap].some(p => bp.has(p)) && an && bn && an !== bn) out.push('SAME_PHONE_DIFFERENT_NAME');
  const ar = normalizeRegistration(a.reported_registration || '');
  const br = normalizeRegistration(b.reported_registration || '');
  if (ar && br && ar === br && an && bn && an !== bn) out.push('SAME_VEHICLE_DIFFERENT_NAME');
  if (a.reported_status && b.reported_status && a.reported_status !== b.reported_status && sameName) out.push('STATUS_CONFLICT');
  return out;
}

function detectAll(records) {
  const conflicts = [];
  for (let i = 0; i < records.length; i++) {
    for (let j = i + 1; j < records.length; j++) {
      for (const type of detectPairConflicts(records[i], records[j])) {
        conflicts.push({ type, record_ids: [records[i].record_id, records[j].record_id] });
      }
    }
  }
  return conflicts;
}

module.exports = { detectPairConflicts, detectAll };
