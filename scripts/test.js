'use strict';

const assert = require('assert');
const { normalizeText, normalizePhone, normalizeRegistration } = require('../engine/normalize');
const { compareRecords } = require('../engine/identity');
const { detectPairConflicts } = require('../engine/conflicts');
const { searchRecords } = require('../engine/search');
const { deriveCurrentStatus } = require('../engine/status');

assert.equal(normalizePhone('९८६०१०६४८१'), '9860106481');
assert.equal(normalizeRegistration('M P 03001 K 3617'), 'MP03001K3617');
assert.equal(normalizeText('Hetauda-6'), 'hetauda 6');

const a = { record_id:'A', original_name:'Suman Tamang', reported_phone_numbers:[], reported_age:null, reported_district:'Makwanpur' };
const b = { record_id:'B', original_name:'Suman Tamang', reported_phone_numbers:[], reported_age:null, reported_district:'Makwanpur' };
assert.equal(compareRecords(a,b).classification, 'POSSIBLE_MATCH');
assert.notEqual(compareRecords(a,b).classification, 'CONFIRMED_MATCH');

const c = { record_id:'C', original_name:'Alpha', reported_phone_numbers:['9800000000'], reported_age:22 };
const d = { record_id:'D', original_name:'Beta', reported_phone_numbers:['9800000000'], reported_age:22 };
assert.equal(compareRecords(c,d).classification, 'PROBABLE_MATCH');
assert.ok(detectPairConflicts(c,d).includes('SAME_PHONE_DIFFERENT_NAME'));

const rows = [{record_id:'RR-1', original_name:'सुमन तामाङ', transliteration:'Suman Tamang', reported_phone_numbers:['9860106481'], reported_registration:'M P 03001 K 3617'}];
assert.equal(searchRecords(rows, 'Suman Tamang').length, 1);
assert.equal(searchRecords(rows, '9860106481').length, 1);
assert.equal(searchRecords(rows, 'MP03001K3617').length, 1);

const current = deriveCurrentStatus([
  {status_event_id:'S1', status:'MISSING_OFFICIALLY_RECORDED', effective_date:'2026-08-27', authority_type:'police'},
  {status_event_id:'S2', status:'RECONTACTED', effective_date:'2026-08-29', authority_type:'family_first_hand'}
]);
assert.equal(current.status, 'RECONTACTED');

console.log('All tests passed.');
