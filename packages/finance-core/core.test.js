import assert from 'node:assert/strict';
import test from 'node:test';
import { changeField, choices, createApi, formPayload, initialForm, label, loadCollection, validateUpload } from './index.js';

const module = { key: 'transactions', fields: [
  { name: 'account_id', label: 'Account', required: true, type: 'reference', resource: 'accounts' },
  { name: 'amount', label: 'Amount', required: true, type: 'decimal' },
  { name: 'transaction_type', label: 'Direction', required: true },
  { name: 'entry_type', default: 'OTHER' }, { name: 'category_id', nullable: true },
  { name: 'frequency', default: 'ONETIME', create_only: true }, { name: 'end_date', nullable: true, create_only: true }
] };

test('web/mobile defaults are one-time salary entries', () => {
  const result = initialForm(module);
  assert.equal(result.frequency, 'ONETIME'); assert.equal(result.entry_type, 'SALARY');
  assert.match(result.transaction_date, /^\d{4}-\d{2}-\d{2}$/);
});
test('direction changes clear incompatible category and classification', () => {
  const changed = changeField({ transaction_type: 'INCOME', entry_type: 'SALARY', category_id: '5' }, 'transaction_type', 'EXPENSE', module);
  assert.equal(changed.entry_type, 'OTHER'); assert.equal(changed.category_id, '');
  assert.equal(changeField(changed, 'transaction_type', 'TRANSFER', module).frequency, 'ONETIME');
});
test('one-time selection removes old end date', () => assert.equal(changeField({ end_date: '2026-09-12' }, 'frequency', 'ONETIME', module).end_date, ''));
test('payload retains exact large money values and ID strings', () => {
  const payload = formPayload(module, { account_id: '9007199254740993', amount: '123456789012345.1234', transaction_type: 'INCOME', frequency: 'ONETIME', end_date: '2026-09-12' });
  assert.equal(payload.amount, '123456789012345.1234'); assert.equal(payload.account_id, '9007199254740993'); assert.ok(!('end_date' in payload));
});
test('required values cannot be empty or whitespace', () => assert.throws(() => formPayload(module, { account_id: ' ' }), /Account is required/));
test('editing can clear nullable fields without overwriting schedule controls', () => {
  const payload = formPayload(module, { account_id: '1', amount: '0', transaction_type: 'EXPENSE', category_id: '', frequency: 'MONTHLY' }, true);
  assert.equal(payload.category_id, null); assert.ok(!('frequency' in payload));
});
test('optional bank name and description stay optional for minimal accounts', () => {
  const accountModule = { key: 'accounts', fields: [{ name: 'name', label: 'Name', required: true }, { name: 'institution', nullable: true }, { name: 'description', nullable: true }] };
  assert.deepEqual(formPayload(accountModule, { name: 'Cash', institution: '', description: '' }), { name: 'Cash' });
});
test('reference choices filter income/expense categories and inactive accounts', () => {
  const refs = { categories: [{ id: 1, name: 'Food', category_type: 'EXPENSE' }, { id: 2, name: 'Salary', category_type: 'INCOME' }], accounts: [{ id: 7, name: 'Old', status: 'INACTIVE' }, { id: 8, name: 'Salary', institution: 'SBI', status: 'ACTIVE' }] };
  assert.deepEqual(choices({ type: 'reference', resource: 'categories' }, { transaction_type: 'EXPENSE' }, refs, 'transactions').map(o => o.value), ['1']);
  assert.deepEqual(choices(module.fields[0], {}, refs, 'transactions').map(o => o.value), ['8']);
  assert.match(choices(module.fields[0], {}, refs, 'transactions')[0].label, /SBI/);
});
test('loadCollection fetches references beyond the first API page', async () => {
  const calls = [];
  const items = await loadCollection(async path => { calls.push(path); return { items: Array.from({ length: calls.length === 1 ? 100 : 3 }, (_, i) => ({ id: i })), meta: { total: 103 } }; }, '/accounts?status=ACTIVE');
  assert.equal(items.length, 103); assert.match(calls[1], /status=ACTIVE&limit=100&offset=100/);
});
test('loadCollection preserves failures for retry instead of treating them as empty accounts', async () => {
  await assert.rejects(loadCollection(async () => { throw new Error('Offline'); }, '/accounts'), /Offline/);
});
test('upload rejects non-CSV and oversized input', () => {
  assert.doesNotThrow(() => validateUpload('sample.CSV', 1000));
  assert.throws(() => validateUpload('sample.xlsx', 10), /csv/);
  assert.throws(() => validateUpload('sample.csv', 1000001), /1 MB/);
});
test('request includes family-session auth and JSON bodies', async () => {
  let request;
  const api = createApi('https://example.test/api/v1/', () => 'test-token', async (url, options) => { request = { url, options }; return { ok: true, json: async () => ({ data: { id: 7 } }) }; });
  assert.deepEqual(await api('/accounts', { method: 'POST', body: { name: 'Cash' } }), { id: 7 });
  assert.equal(request.options.headers.Authorization, 'Bearer test-token'); assert.equal(request.options.body, '{"name":"Cash"}');
});
test('request reports validation and non-JSON hosting errors', async () => {
  const api = createApi('', () => '', async () => ({ ok: false, json: async () => ({ error: { message: 'Invalid row', details: [{ row: 2 }] } }) }));
  await assert.rejects(api('/imports'), e => e.message === 'Invalid row' && e.details[0].row === 2);
  await assert.rejects(createApi('', () => '', async () => ({ json: async () => { throw new Error('html'); } }))('/catalog'), /non-JSON/);
});
test('one-time labels and edit state are consistent', () => {
  assert.equal(label('ONETIME'), 'One-time'); assert.equal(label('DIVIDEND'), 'Dividend');
  assert.ok(!('frequency' in initialForm(module, { frequency: 'MONTHLY' })));
});
