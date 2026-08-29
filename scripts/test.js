'use strict';

const assert = require('assert');
const { normalizeText, normalizePhone, normalizeRegistration } = require('../engine/normalize');
const { compareRecords } = require('../engine/identity');

assert.equal(normalizePhone('९८६०१०६४८१'), '9860106481');
assert.equal(normalizeRegistration('M P 03001 K 3617'), 'MP03001K3617');
assert.equal(normalizeText('Hetauda-6'), 'hetauda 6');
const a = { original_name:'Suman Tamang', reported_phone_numbers:[], reported_age:null };
const b = { original_name:'Suman Tamang', reported_phone_numbers:[], reported_age:null };
assert.equal(compareRecords(a,b).classification, 'POSSIBLE_MATCH');
assert.notEqual(compareRecords(a,b).classification, 'CONFIRMED_MATCH');
console.log('All tests passed.');
