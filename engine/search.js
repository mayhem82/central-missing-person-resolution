'use strict';

const { normalizeText, normalizePhone, normalizeRegistration } = require('./normalize');

function recordHaystack(r) {
  return [
    r.record_id, r.original_name, r.transliteration, r.reported_address,
    r.reported_locality, r.reported_ward, r.reported_district,
    ...(r.reported_phone_numbers || []), r.reported_vehicle,
    r.reported_registration, r.reported_purpose, r.reported_status
  ].filter(Boolean).join(' ');
}

function searchRecords(records, query) {
  const qText = normalizeText(query);
  const qPhone = normalizePhone(query);
  const qReg = normalizeRegistration(query);
  return records.filter(r => {
    const hay = normalizeText(recordHaystack(r));
    if (qText && hay.includes(qText)) return true;
    if (qPhone.length >= 6 && (r.reported_phone_numbers || []).map(normalizePhone).some(p => p.includes(qPhone))) return true;
    if (qReg.length >= 5 && normalizeRegistration(r.reported_registration || '').includes(qReg)) return true;
    return false;
  });
}

module.exports = { searchRecords };
