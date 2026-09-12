import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAccountOptions, getAccountTypeLabel } from './account-options.js';

test('buildAccountOptions creates readable labels with optional bank names', function () {
  var options = buildAccountOptions([
    { id: 11, name: 'Salary account', account_type: 'BANK', institution: 'SBI', status: 'ACTIVE' },
    { id: 12, name: 'Pocket cash', account_type: 'CASH', institution: null, status: 'ACTIVE' }
  ]);

  assert.deepEqual(options, [
    { value: '11', label: 'Salary account — SBI (Bank account)' },
    { value: '12', label: 'Pocket cash (Cash)' }
  ]);
});

test('buildAccountOptions excludes inactive accounts from transaction choices', function () {
  var options = buildAccountOptions([
    { id: 20, name: 'Old account', account_type: 'BANK', institution: 'ICICI', status: 'INACTIVE' }
  ]);

  assert.deepEqual(options, []);
});

test('getAccountTypeLabel falls back safely for an unknown type', function () {
  assert.equal(getAccountTypeLabel('CUSTOM'), 'CUSTOM');
  assert.equal(getAccountTypeLabel(''), 'Account');
});
