'use strict';

const { normalizeText, normalizePhone, normalizeRegistration } = require('./normalize');

function compareRecords(a, b) {
  const signals = [];
  const conflicts = [];
  const an = normalizeText(a.original_name || a.transliteration || '');
  const bn = normalizeText(b.original_name || b.transliteration || '');
  if (an && bn && an === bn) signals.push('exact-normalized-name');
  const ap = new Set((a.reported_phone_numbers || []).map(normalizePhone).filter(Boolean));
  const bp = new Set((b.reported_phone_numbers || []).map(normalizePhone).filter(Boolean));
  if ([...ap].some(p => bp.has(p))) signals.push('shared-phone');
  const ar = normalizeRegistration(a.reported_registration || '');
  const br = normalizeRegistration(b.reported_registration || '');
  if (ar && br && ar === br) signals.push('shared-vehicle-registration');
  if (a.reported_age != null && b.reported_age != null && a.reported_age !== b.reported_age) conflicts.push('age-conflict');
  if (a.reported_district && b.reported_district && normalizeText(a.reported_district) !== normalizeText(b.reported_district)) conflicts.push('district-conflict');
  let classification = 'UNKNOWN';
  if (signals.includes('shared-phone') || signals.includes('shared-vehicle-registration')) classification = conflicts.length ? 'CONFLICTING_MATCH' : 'PROBABLE_MATCH';
  else if (signals.includes('exact-normalized-name')) classification = conflicts.length ? 'CONFLICTING_MATCH' : 'POSSIBLE_MATCH';
  return { classification, signals, conflicts };
}

module.exports = { compareRecords };
