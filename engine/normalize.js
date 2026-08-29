'use strict';

const devanagariDigits = '०१२३४५६७८९';
const asciiDigits = '0123456789';

function devanagariToAscii(value='') {
  return [...String(value)].map(ch => {
    const i = devanagariDigits.indexOf(ch);
    return i >= 0 ? asciiDigits[i] : ch;
  }).join('');
}

function normalizeText(value='') {
  return devanagariToAscii(String(value))
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizePhone(value='') {
  return devanagariToAscii(String(value)).replace(/\D/g, '');
}

function normalizeRegistration(value='') {
  return devanagariToAscii(String(value)).toUpperCase().replace(/[^A-Z0-9\u0900-\u097F]/g, '');
}

module.exports = { normalizeText, normalizePhone, normalizeRegistration, devanagariToAscii };
