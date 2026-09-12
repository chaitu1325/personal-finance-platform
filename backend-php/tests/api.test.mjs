import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// This suite writes only to the disposable database prepared by CI.
if (process.env.ALLOW_INTEGRATION_TESTS !== '1' || process.env.DB_NAME !== 'personal_finance'
    || !['127.0.0.1', 'localhost'].includes(process.env.DB_HOST)) {
  throw new Error('Run with ALLOW_INTEGRATION_TESTS=1 and a disposable local personal_finance database');
}
const root = fileURLToPath(new URL('../../', import.meta.url));
const base = 'http://127.0.0.1:8080/api/v1';
let server, serverLog = '', primary, other, account, foreignAccount, incomeCategory, expenseCategory;
const today = new Date().toISOString().slice(0, 10);

async function request(path, { token, method = 'GET', body, status = 200 } = {}) {
  const response = await fetch(base + path, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000)
  });
  const text = await response.text();
  assert.equal(response.status, status, method + ' ' + path + ': ' + text);
  return JSON.parse(text);
}
async function call(path, options = {}, session = primary) {
  const result = await request(path, { token: session.token, ...options });
  return options.status && options.status >= 400 ? result.error : result.data;
}
const create = (resource, body, session = primary) => call('/' + resource, { method: 'POST', body, status: 201 }, session);
const patch = (resource, id, body) => call('/' + resource + '?id=' + id, { method: 'PATCH', body });
const upload = (resource, csv, action = 'commit', status = 200, session = primary) => call('/imports', { method: 'POST', body: { resource, csv, action }, status }, session);
const transaction = overrides => ({ account_id: account.id, transaction_type: 'EXPENSE', entry_type: 'BILL', category_id: expenseCategory.id,
  amount: '12.3400', transaction_date: today, frequency: 'ONETIME', ...overrides });
const processDue = () => call('/recurring-run', { method: 'POST', body: {} });

before(async () => {
  server = spawn('php', ['-S', '127.0.0.1:8080', '-t', 'backend-php', 'backend-php/router.php'], { cwd: root, env: process.env });
  server.stderr.on('data', chunk => { serverLog += chunk; });
  server.on('error', error => { serverLog += error.message; });
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { const health = await fetch(base + '/health'); if (health.ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, 'PHP server/database did not become healthy: ' + serverLog);
  const register = async name => (await request('/auth/register', { method: 'POST', status: 201,
    body: { email: randomUUID() + '@example.test', display_name: name, password: 'Disposable-test-password-81' } })).data;
  primary = await register('Primary Family'); other = await register('Other Family');
  account = await create('accounts', { name: 'Family bank', account_type: 'BANK', currency: 'INR' });
  foreignAccount = await create('accounts', { name: 'Other bank', account_type: 'BANK' }, other);
  incomeCategory = await create('categories', { name: 'Test income', category_type: 'INCOME' });
  expenseCategory = await create('categories', { name: 'Test spending', category_type: 'EXPENSE' });
});
after(() => { server?.kill(); });

test('catalog, templates and writes require authentication and correct methods', async () => {
  for (const path of ['/catalog', '/imports?resource=accounts', '/recurring-transactions']) await request(path, { status: 401 });
  await request('/recurring-run', { method: 'POST', body: {}, status: 401 });
  await call('/catalog', { method: 'POST', body: {}, status: 405 });
  await call('/recurring-run', { status: 405 });
  await call('/imports?resource=users', { status: 422 });
  const catalog = await call('/catalog');
  assert.equal(catalog.modules.length, 18);
  const fields = catalog.modules.find(m => m.key === 'transactions').fields;
  assert.deepEqual(fields.find(f => f.name === 'frequency').options, ['ONETIME', 'WEEKLY', 'MONTHLY', 'YEARLY']);
  assert.ok(fields.find(f => f.name === 'entry_type').options_by_direction.INCOME.includes('DIVIDEND'));
});

test('income/expense classification, optional account fields, and category validation', async () => {
  assert.equal(account.institution, null); assert.equal(account.description, null);
  const updatedAccount = await patch('accounts', account.id, { institution: 'SBI', description: 'Family salary account' });
  assert.equal(updatedAccount.institution, 'SBI');
  assert.equal((await patch('accounts', account.id, { description: null })).description, null);
  const created = await create('transactions', transaction({ amount: '123456789012345.1234' }));
  assert.equal(created.amount, '123456789012345.1234');
  assert.equal(created.entry_type, 'BILL'); assert.equal(created.frequency, 'ONETIME'); assert.equal(created.recurring_id, null);
  await call('/transactions', { method: 'POST', body: transaction({ entry_type: 'SALARY' }), status: 422 });
  await call('/transactions', { method: 'POST', body: transaction({ category_id: incomeCategory.id }), status: 422 });
  for (const overrides of [{ amount: '-1' }, { amount: '1e99' }, { amount: '1.00001' }, { amount: null },
    { transaction_date: '2026-02-30' }, { account_id: 0 }, { frequency: 'HOURLY' }, { entry_type: {} }]) {
    await call('/transactions', { method: 'POST', body: transaction(overrides), status: 422 });
  }
  await call('/transactions?from=bad-date', { status: 422 });
  await call('/transactions?from=2026-09-02&to=2026-09-01', { status: 422 });
  await call('/categories?id=' + expenseCategory.id, { method: 'PATCH', body: { category_type: 'INCOME' }, status: 422 });
  await call('/transactions?id=' + created.id, { method: 'PATCH', body: { frequency: 'MONTHLY' }, status: 422 });
  const global = (await call('/categories')).items.find(c => c.family_id === null);
  await call('/categories?id=' + global.id, { method: 'PATCH', body: { name: 'Changed global' }, status: 422 });
  await call('/categories?id=' + global.id, { method: 'DELETE', body: {}, status: 404 });
});

test('family isolation is enforced on reads, references, edits, uploads, and ownership', async () => {
  await call('/accounts?id=' + foreignAccount.id, { status: 404 });
  await call('/accounts?id=' + foreignAccount.id, { method: 'PATCH', body: { name: 'Forbidden' }, status: 422 });
  await call('/transactions', { method: 'POST', body: transaction({ account_id: foreignAccount.id }), status: 422 });
  const foreignCategory = await create('categories', { name: 'Private expense', category_type: 'EXPENSE' }, other);
  await call('/transactions', { method: 'POST', body: transaction({ category_id: foreignCategory.id }), status: 422 });
  const created = await create('accounts', { name: 'Cannot override family', account_type: 'CASH', family_id: other.user.family_id, created_by: other.user.id });
  assert.equal(String(created.family_id), String(primary.user.family_id));
  const csv = `account_id,transaction_type,amount,transaction_date\n${foreignAccount.id},EXPENSE,20,${today}\n`;
  const preview = await upload('transactions', csv, 'preview');
  assert.equal(preview.valid, false); assert.match(preview.errors[0].message, /not found in this family/);
  await upload('transactions', csv, 'commit', 422);
});

test('recurring entries preserve month-end anchors, stop at end dates, and survive retries', async () => {
  const first = await create('transactions', transaction({ transaction_type: 'INCOME', entry_type: 'SALARY', category_id: incomeCategory.id,
    amount: '100', transaction_date: '2024-01-31', frequency: 'MONTHLY', end_date: '2024-03-31' }));
  assert.ok(first.recurring_id);
  const schedule = await call('/recurring-transactions?id=' + first.recurring_id);
  assert.equal(schedule.start_date, '2024-01-31'); assert.equal(schedule.next_run_date, '2024-02-29');
  // Full-form edits include unchanged recurrence controls: they must keep the original day anchor.
  await patch('recurring-transactions', schedule.id, { amount: '110', frequency: schedule.frequency, next_run_date: schedule.next_run_date });
  const result = await processDue(); assert.equal(result.created, 2);
  const entries = (await call('/transactions?from=2024-01-01&to=2024-03-31')).items.filter(t => String(t.recurring_id) === String(first.recurring_id));
  assert.deepEqual(entries.map(e => e.transaction_date).sort(), ['2024-01-31', '2024-02-29', '2024-03-31']);
  assert.equal(entries.find(e => e.transaction_date === '2024-02-29').amount, '110.0000');
  assert.equal((await processDue()).created, 0);
  assert.equal((await call('/recurring-transactions?id=' + schedule.id)).is_active, 0);
});

test('one-time, weekly and yearly schedules execute once per due date; paused/foreign schedules stay untouched', async () => {
  for (const [frequency, start, end, expected] of [
    ['ONETIME', '2024-01-01', null, 1], ['WEEKLY', '2024-01-01', '2024-01-15', 3], ['YEARLY', '2024-02-29', '2025-02-28', 2]
  ]) {
    const s = await create('recurring-transactions', { ...transaction(), frequency, next_run_date: start, end_date: end });
    assert.equal((await processDue()).created, expected);
    assert.equal((await processDue()).created, 0);
    assert.equal((await call('/recurring-transactions?id=' + s.id)).is_active, 0);
  }
  const paused = await create('recurring-transactions', { ...transaction(), frequency: 'ONETIME', next_run_date: '2024-01-01', is_active: 0 });
  const foreign = await create('recurring-transactions', { account_id: foreignAccount.id, transaction_type: 'INCOME', amount: '50', frequency: 'ONETIME', next_run_date: '2024-01-01' }, other);
  assert.equal((await processDue()).created, 0);
  assert.equal((await call('/recurring-transactions?id=' + foreign.id, {}, other)).is_active, 1);
  await patch('recurring-transactions', paused.id, { is_active: 1 });
  assert.equal((await processDue()).created, 1);
  const inactive = await create('accounts', { name: 'Inactive test', account_type: 'CASH' });
  const skipped = await create('recurring-transactions', { ...transaction({ account_id: inactive.id }), frequency: 'ONETIME', next_run_date: '2024-01-01' });
  await patch('accounts', inactive.id, { status: 'INACTIVE' });
  await call('/transactions', { method: 'POST', body: transaction({ account_id: inactive.id }), status: 422 });
  assert.ok((await processDue()).skipped.some(s => String(s.id) === String(skipped.id)));
  await patch('recurring-transactions', skipped.id, { is_active: 0 });
});

test('catch-up is bounded to 200 entries and resumes without duplicate dates', async () => {
  const schedule = await create('recurring-transactions', { ...transaction(), frequency: 'DAILY', next_run_date: '2020-01-01' });
  assert.equal((await processDue()).created, 200);
  const afterFirst = await call('/recurring-transactions?id=' + schedule.id);
  assert.equal(afterFirst.next_run_date, '2020-07-19');
  assert.equal((await processDue()).created, 200);
  assert.equal((await call('/recurring-transactions?id=' + schedule.id)).next_run_date, '2021-02-04');
  await patch('recurring-transactions', schedule.id, { is_active: 0 });
});

test('expense analysis separates categories, payment types, currencies and families', async () => {
  const category = await create('categories', { name: 'Analysis groceries', category_type: 'EXPENSE' });
  const usd = await create('accounts', { name: 'Dollar account', account_type: 'BANK', currency: 'USD' });
  const data = { transaction_date: '2023-05-12', category_id: category.id, entry_type: 'PURCHASE' };
  await create('transactions', transaction({ ...data, amount: '20.25' }));
  await create('transactions', transaction({ ...data, amount: '5.75' }));
  await create('transactions', transaction({ ...data, account_id: usd.id, amount: '3.00' }));
  await create('transactions', transaction({ ...data, transaction_type: 'INCOME', entry_type: 'DIVIDEND', category_id: incomeCategory.id, amount: '99' }));
  await create('transactions', transaction({ ...data, account_id: foreignAccount.id, category_id: null, amount: '999' }), other);
  const report = await call('/reports?type=spending&from=2023-05-01&to=2023-05-31');
  assert.equal(report.items.length, 2);
  assert.equal(report.items.find(i => i.currency === 'INR').amount, '26.0000');
  assert.equal(report.items.find(i => i.currency === 'USD').amount, '3.0000');
  const byType = await call('/reports?type=spending&group=entry_type&from=2023-05-01&to=2023-05-31');
  assert.ok(byType.items.every(i => i.category === 'PURCHASE'));
  const filtered = await call('/transactions?type=EXPENSE&category=' + category.id + '&from=2023-05-01&to=2023-05-31');
  assert.equal(filtered.meta.total, 3);
  await call('/reports?type=spending&from=2026-02-30', { status: 422 });
});

test('CSV preview is read-only; commit is atomic and repeated category uploads are harmless', async () => {
  const csv = 'name,category_type\nNew imported category,EXPENSE\n';
  const beforeCount = (await call('/categories')).meta.total;
  assert.equal((await upload('categories', csv, 'preview')).valid, true);
  assert.equal((await call('/categories')).meta.total, beforeCount);
  assert.equal((await upload('categories', csv)).imported, 1);
  assert.equal((await upload('categories', csv, 'preview')).already_imported, true);
  assert.equal((await upload('categories', csv.replaceAll('\n', '\r\n'))).already_imported, true);
  assert.equal((await call('/categories')).meta.total, beforeCount + 1);
  const duplicate = 'name,category_type\nRollback category,EXPENSE\nRollback category,EXPENSE\n';
  await upload('categories', duplicate, 'commit', 422);
  assert.equal((await call('/categories')).meta.total, beforeCount + 1);
  const schedules = (await call('/recurring-transactions')).meta.total;
  const transactions = (await call('/transactions')).meta.total;
  const badRows = `account_id,transaction_type,amount,transaction_date,frequency\n${account.id},INCOME,100,2099-01-01,MONTHLY\n${account.id},INCOME,-1,2099-01-01,MONTHLY\n`;
  const preview = await upload('transactions', badRows, 'preview');
  assert.equal(preview.valid, false); assert.equal(preview.errors[0].row, 3);
  await upload('transactions', badRows, 'commit', 422);
  assert.equal((await call('/recurring-transactions')).meta.total, schedules);
  assert.equal((await call('/transactions')).meta.total, transactions);
  for (const invalid of ['name,account_type,family_id\nBad,CASH,1', 'name,name\nA,B', 'name,account_type\n"unclosed,CASH',
    'name,account_type\n' + 'Many,CASH\n'.repeat(201), 'x'.repeat(1000001)]) {
    await upload('accounts', invalid, 'preview', 422);
  }
});

test('every writable record type has a usable CSV sample, import, and repeat protection', async () => {
  const modules = (await call('/catalog')).modules;
  const ids = { ACCOUNT_ID: account.id, CATEGORY_ID: incomeCategory.id };
  // Reference parents precede dependent records in the catalog.
  for (const module of modules) {
    const sample = await call('/imports?resource=' + module.key);
    assert.ok(sample.filename.endsWith('.csv'));
    const csv = sample.csv.replaceAll('2026-09-01', '2099-01-01').replace(/\b[A-Z]+_ID\b/g, key => {
      assert.ok(ids[key], module.key + ' is missing parent ' + key); return String(ids[key]);
    });
    const beforeIds = new Set((await call(module.endpoint + '?limit=100')).items.map(i => String(i.id)));
    const preview = await upload(module.key, csv, 'preview');
    assert.equal(preview.valid, true, module.key + ': ' + JSON.stringify(preview.errors));
    assert.equal((await upload(module.key, csv)).imported, 1, module.key);
    assert.equal((await upload(module.key, csv)).already_imported, true, module.key + ' repeated upload');
    const added = (await call(module.endpoint + '?limit=100')).items.find(i => !beforeIds.has(String(i.id)));
    assert.ok(added, 'Find imported ' + module.key);
    const reference = { persons: 'PERSON_ID', properties: 'PROPERTY_ID', 'rental-units': 'UNIT_ID',
      'rental-agreements': 'AGREEMENT_ID', investments: 'INVESTMENT_ID', assets: 'ASSET_ID', liabilities: 'LIABILITY_ID' }[module.key];
    if (reference) ids[reference] = added.id;
  }
  for (const resource of ['transactions', 'recurring-transactions']) {
    const sample = await call('/imports?resource=' + resource + '&direction=EXPENSE');
    const csv = sample.csv.replaceAll('2026-09-01', '2099-01-01').replaceAll('ACCOUNT_ID', account.id).replaceAll('CATEGORY_ID', expenseCategory.id);
    assert.equal((await upload(resource, csv, 'preview')).valid, true);
    assert.equal((await upload(resource, csv)).imported, 1);
  }
});
