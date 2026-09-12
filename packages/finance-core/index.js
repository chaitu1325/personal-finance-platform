export const IMPORT_MAX_BYTES = 1000000;

export function label(value) {
  if (value === 'ONETIME') return 'One-time';
  if (value === 'EMI') return 'EMI';
  return String(value ?? '').toLowerCase().replaceAll('_', ' ').replace(/^./, c => c.toUpperCase());
}

export function recordName(item) {
  return item.name || item.full_name || item.property_name || item.unit_label || item.description || `Record #${item.id}`;
}

export function initialForm(module, record) {
  if (record) return Object.fromEntries(module.fields.filter(f => !f.create_only).map(f => [f.name, record[f.name] ?? '']));
  const form = Object.fromEntries(module.fields.filter(f => f.default !== undefined).map(f => [f.name, String(f.default)]));
  if (['transactions', 'recurring-transactions'].includes(module.key)) {
    form.transaction_type = 'INCOME';
    form.entry_type = 'SALARY';
    form.frequency = module.key === 'transactions' ? 'ONETIME' : 'MONTHLY';
    form[module.key === 'transactions' ? 'transaction_date' : 'next_run_date'] = new Date().toISOString().slice(0, 10);
  }
  return form;
}

export function changeField(form, name, value, module) {
  const next = { ...form, [name]: value };
  if (name === 'transaction_type' && ['transactions', 'recurring-transactions'].includes(module.key)) {
    next.entry_type = value === 'INCOME' ? 'SALARY' : 'OTHER';
    next.category_id = '';
    if (!['INCOME', 'EXPENSE'].includes(value)) next.frequency = 'ONETIME';
  }
  if (name === 'frequency' && value === 'ONETIME') next.end_date = '';
  return next;
}

export function choices(field, form, references, moduleKey) {
  if (field.options_by_direction) return (field.options_by_direction[form.transaction_type] || []).map(value => ({ value, label: label(value) }));
  if (field.type === 'reference') {
    return (references[field.resource] || []).filter(item => {
      if (field.resource === 'accounts' && item.status !== 'ACTIVE' && String(item.id) !== String(form[field.name])) return false;
      if (field.resource === 'categories') {
        const direction = moduleKey === 'budgets' ? 'EXPENSE' : form.transaction_type;
        if (direction && item.category_type !== direction) return false;
      }
      return true;
    }).map(item => ({ value: String(item.id), label: `${recordName(item)}${item.institution ? ` — ${item.institution}` : ''} (#${item.id})` }));
  }
  const options = field.name === 'frequency' && moduleKey === 'transactions' && !['INCOME', 'EXPENSE'].includes(form.transaction_type) ? ['ONETIME'] : field.options || [];
  return options.map(value => ({ value, label: label(value) }));
}

export function formPayload(module, form, editing = false) {
  const result = {};
  for (const field of module.fields) {
    if (editing && field.create_only) continue;
    const value = typeof form[field.name] === 'string' ? form[field.name].trim() : form[field.name];
    if (value === '' || value === undefined || value === null) {
      if (field.required) throw new Error(`${field.label} is required`);
      if (editing && field.nullable) result[field.name] = null;
      continue;
    }
    // Keep decimal values and BIGINT IDs as strings to avoid precision loss.
    result[field.name] = value;
  }
  if (result.frequency === 'ONETIME') {
    if (editing && module.key === 'recurring-transactions') result.end_date = null;
    else delete result.end_date;
  }
  return result;
}

export async function loadCollection(api, path) {
  const items = [];
  for (let offset = 0; ; offset += 100) {
    const result = await api(`${path}${path.includes('?') ? '&' : '?'}limit=100&offset=${offset}`);
    const page = Array.isArray(result) ? result : result.items || [];
    items.push(...page);
    if (page.length < 100 || items.length >= (result.meta?.total ?? Infinity)) return items;
    if (offset >= 9900) throw new Error('Too many records to load. Narrow the date/type filters.');
  }
}

export function validateUpload(name, size) {
  if (!/\.csv$/i.test(name)) throw new Error('Choose a UTF-8 .csv file using the sample template');
  if (size > IMPORT_MAX_BYTES) throw new Error('CSV exceeds the 1 MB limit');
}

export function createApi(base, getToken, fetcher = fetch) {
  return async function api(path, options = {}) {
    const headers = { Accept: 'application/json', ...options.headers };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    let body = options.body;
    if (body && typeof body !== 'string') { headers['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
    const response = await fetcher(base.replace(/\/$/, '') + path, { ...options, headers, body });
    let payload;
    try { payload = await response.json(); } catch { throw new Error('API returned non-JSON content. Check the API URL and hosting access.'); }
    if (!response.ok) {
      const error = new Error(payload.error?.message || `Request failed (${response.status})`);
      error.details = payload.error?.details;
      throw error;
    }
    return payload.data === undefined ? payload : payload.data;
  };
}
