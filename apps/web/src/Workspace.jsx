import { useEffect, useRef, useState } from 'react';
import { changeField, choices, formPayload, initialForm, label, loadCollection, recordName, validateUpload } from '../../../packages/finance-core/index.js';

export function Workspace({ module, api, onNavigate }) {
  const [items, setItems] = useState([]);
  const [refs, setRefs] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => initialForm(module));
  const [revision, setRevision] = useState(0);
  const [filter, setFilter] = useState({ type: '', from: '', to: '', category: '' });
  const saving = useRef(false);
  const query = new URLSearchParams(Object.entries(filter).filter(([, value]) => value)).toString();
  const path = module.endpoint + (module.key === 'transactions' && query ? '?' + query : '');

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    const resources = [...new Set(module.fields.filter(f => f.resource).map(f => f.resource))];
    Promise.all([loadCollection(api, path), Promise.all(resources.map(async key => [key, await loadCollection(api, '/' + key)]))])
      .then(([records, references]) => { if (live) { setItems(records); setRefs(Object.fromEntries(references)); } })
      .catch(e => { if (live) setError(e.message); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [api, module, path, revision]);

  const needsAccount = ['transactions', 'recurring-transactions'].includes(module.key) && !loading && !error && !(refs.accounts || []).some(a => a.status === 'ACTIVE');

  async function save(event) {
    event.preventDefault();
    if (saving.current) return;
    saving.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const body = formPayload(module, form, Boolean(editing));
      await api(module.endpoint + (editing ? '?id=' + editing.id : ''), { method: editing ? 'PATCH' : 'POST', body });
      setMessage('Saved successfully.'); setOpen(false); setEditing(null); setForm(initialForm(module)); setRevision(r => r + 1);
    } catch (e) { setError(e.message); }
    finally { saving.current = false; setBusy(false); }
  }

  async function processDue() {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const result = await api('/recurring-run', { method: 'POST', body: {} });
      setMessage(`Posted ${result.created} due entries. ${result.pending_schedules} schedules still due.${result.skipped.length ? ' Skipped: ' + result.skipped.map(s => '#' + s.id + ' ' + s.message).join('; ') : ''}`);
      setRevision(r => r + 1);
    } catch (e) { setError(e.message); }
    finally { saving.current = false; setBusy(false); }
  }

  return <div>
    <div className="welcome"><div><p className="eyebrow">Family workspace</p><h1>{module.label}</h1><p className="muted">Create, update and import your family’s records.</p></div>
      <button className="primary" disabled={loading || busy || Boolean(error && !items.length)} onClick={() => { setOpen(!open); setEditing(null); setForm(initialForm(module)); }}>{open ? 'Close form' : 'Add record'}</button></div>
    {module.key === 'transactions' && <section className="panel filters"><h2>Filter entries</h2><div className="form-grid">
      <label className="field">Direction<select value={filter.type} onChange={e => setFilter({ ...filter, type: e.target.value, category: '' })}><option value="">All</option><option>INCOME</option><option>EXPENSE</option></select></label>
      <label className="field">Category<select value={filter.category} onChange={e => setFilter({ ...filter, category: e.target.value })}><option value="">All</option>{(refs.categories || []).filter(c => !filter.type || c.category_type === filter.type).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      {['from', 'to'].map(key => <label className="field" key={key}>{label(key)}<input type="date" value={filter[key]} onChange={e => setFilter({ ...filter, [key]: e.target.value })} /></label>)}
    </div></section>}
    {['transactions', 'recurring-transactions'].includes(module.key) && <div className="action-row"><button className="quiet-button" disabled={busy} onClick={processDue}>Process due entries</button><button className="quiet-button" onClick={() => onNavigate('categories')}>Manage categories</button><button className="quiet-button" onClick={() => onNavigate('recurring-transactions')}>Recurring schedules</button><button className="quiet-button" onClick={() => onNavigate('analysis')}>Expense analysis</button></div>}
    {needsAccount && <section className="panel empty-callout"><div><h2>Create an account first</h2><p className="muted">Income and expenses need an active cash, bank, card or wallet account.</p></div><button className="primary" onClick={() => onNavigate('accounts')}>Go to Accounts</button></section>}
    {error && <p className="error" role="alert">{error}</p>}{message && <p className="success" role="status">{message}</p>}
    {open && (!needsAccount || editing) && <section className="panel form-panel"><h2>{editing ? 'Edit record #' + editing.id : 'New record'}</h2>
      <p className="muted">Fields marked * are required. Optional values can be left blank.</p>
      {['transactions', 'recurring-transactions'].includes(module.key) && <p className="muted">Income/expense type describes the payment. Category groups it for analysis. Recurring entries post when you process due entries or when the server job runs; they do not move money at a bank.</p>}
      <form onSubmit={save}><fieldset className="form-grid" disabled={busy || loading}>
        {module.fields.filter(f => !(editing && f.create_only) && !(f.name === 'end_date' && form.frequency === 'ONETIME')).map(field => <WebField key={field.name} field={field} form={form} refs={refs} moduleKey={module.key} onChange={(name, value) => setForm(current => changeField(current, name, value, module))} />)}
        <div className="form-actions"><button className="primary" disabled={busy || loading}>{busy ? 'Saving…' : 'Save record'}</button></div>
      </fieldset></form></section>}
    <ImportPanel module={module} api={api} onImported={() => setRevision(r => r + 1)} />
    <section className="panel"><div className="panel-heading"><h2>Records ({items.length})</h2><button className="quiet-button" disabled={loading || busy} onClick={() => setRevision(r => r + 1)}>Refresh</button></div>
      {loading ? <p role="status">Loading records and related accounts/categories…</p> : !items.length ? <p className="muted">No records found.</p> : <div className="record-list">{items.map(item => <article className="record" key={item.id}>
        <div><strong>{recordName(item)}</strong><small>#{item.id} · {[item.transaction_type, item.entry_type, item.frequency, item.status, item.is_active === 0 ? 'PAUSED' : '', item.transaction_date, item.next_run_date].filter(Boolean).map(label).join(' · ')}</small>
          {item.institution && <small>{item.institution}</small>}{module.key === 'accounts' && item.description && <p className="muted">{item.description}</p>}
          {item.category_id && <small>Category: {(refs.categories || []).find(c => String(c.id) === String(item.category_id))?.name || '#' + item.category_id}</small>}
        </div><div className="record-actions"><strong>{item.amount ?? item.opening_balance ?? item.current_value ?? item.target_amount ?? ''} {item.currency || ''}</strong>
          {!(module.key === 'categories' && item.family_id === null) && <button className="quiet-button" disabled={busy} onClick={() => { setEditing(item); setForm(initialForm(module, item)); setOpen(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</button>}
        </div></article>)}</div>}
    </section>
  </div>;
}

function WebField({ field, form, refs, moduleKey, onChange }) {
  const common = { name: field.name, value: form[field.name] ?? '', required: field.required, onChange: e => onChange(field.name, e.target.value), maxLength: field.maxLength };
  const options = choices(field, form, refs, moduleKey);
  return <label className={'field' + (field.type === 'textarea' ? ' field-wide' : '')}><span>{field.label}{field.required ? ' *' : ' (optional)'}</span>
    {['select', 'reference'].includes(field.type) ? <select {...common}><option value="">Choose…</option>{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
      : field.type === 'textarea' ? <textarea {...common} rows={3} />
      : <input {...common} type={field.type === 'date' ? 'date' : ['integer', 'decimal'].includes(field.type) ? 'number' : 'text'} step={field.type === 'decimal' ? 'any' : '1'} placeholder={field.name === 'institution' ? 'SBI, ICICI…' : field.type === 'date' ? 'YYYY-MM-DD' : ''} />}
  </label>;
}

function ImportPanel({ module, api, onImported }) {
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  async function template(direction) {
    try {
      setError('');
      const sample = await api(`/imports?resource=${module.key}&direction=${direction}`);
      const url = URL.createObjectURL(new Blob([sample.csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = sample.filename; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError(e.message); }
  }
  async function pick(event) {
    if (running.current) return;
    const file = event.target.files?.[0];
    setPreview(null); setCsv(''); setMessage(''); setError(''); setFileName('');
    if (!file) return;
    running.current = true; setBusy(true);
    try { validateUpload(file.name, file.size); const text = await file.text(); setCsv(text); setFileName(file.name); }
    catch (e) { setError(e.message); }
    finally { running.current = false; setBusy(false); }
  }
  async function send(action) {
    if (running.current) return;
    running.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const result = await api('/imports', { method: 'POST', body: { resource: module.key, csv, action } });
      if (action === 'preview') { setPreview(result); if (result.already_imported) setMessage('This file was already imported; confirming will not add duplicates.'); }
      else { setMessage(result.already_imported ? 'This file was already imported; no duplicates added.' : `Imported ${result.imported} records.`); setPreview(null); setCsv(''); onImported(); }
    } catch (e) { setError(e.message); setPreview(null); }
    finally { running.current = false; setBusy(false); }
  }
  return <details className="panel import-panel"><summary>Bulk upload / sample CSV</summary>
    <p className="muted">UTF-8 CSV, up to 1 MB and 200 rows. Use the sample headers; replace ACCOUNT_ID / CATEGORY_ID and other reference placeholders with IDs shown in your records. Import related records first. No files are stored publicly.</p>
    <div className="action-row"><button className="quiet-button" onClick={() => template('INCOME')}>Download sample template</button>{['transactions', 'recurring-transactions'].includes(module.key) && <button className="quiet-button" onClick={() => template('EXPENSE')}>Expense sample template</button>}</div>
    <label className="field">Choose CSV<input type="file" accept=".csv,text/csv" onChange={pick} disabled={busy} /></label>{fileName && <p>{fileName}</p>}
    <div className="action-row"><button className="primary" disabled={!csv || busy} onClick={() => send('preview')}>Validate & preview</button>{preview?.valid && <button className="primary" disabled={busy} onClick={() => send('commit')}>Confirm import ({preview.row_count} rows)</button>}</div>
    {preview && <div><p>{preview.valid ? `${preview.row_count} valid rows. Preview of the first ${preview.preview.length}:` : 'Correct these rows and upload again:'}</p>{preview.errors.map((e, i) => <p className="error" key={i}>Row {e.row}: {e.message}</p>)}{preview.preview.map((row, i) => <pre className="csv-preview" key={i}>{JSON.stringify(row, null, 2)}</pre>)}</div>}
    {error && <p role="alert" className="error">{error}</p>}{message && <p role="status" className="success">{message}</p>}
  </details>;
}

export function ExpenseAnalysis({ api }) {
  const [filter, setFilter] = useState({ from: new Date().toISOString().slice(0, 7) + '-01', to: new Date().toISOString().slice(0, 10), group: 'category' });
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function load(event) {
    event?.preventDefault(); setBusy(true); setError('');
    try { const result = await api('/reports?type=spending&' + new URLSearchParams(filter)); setItems(result.items); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  useEffect(() => { load(); }, [api]);
  return <div><h1>Expense analysis</h1><p className="muted">Actual recorded expenses grouped by category or payment type, separately for each currency. Uncategorised includes older entries without a category.</p>
    <form className="panel form-grid" onSubmit={load}>{['from', 'to'].map(key => <label className="field" key={key}>{label(key)}<input required type="date" value={filter[key]} onChange={e => setFilter({ ...filter, [key]: e.target.value })} /></label>)}
      <label className="field">Group by<select value={filter.group} onChange={e => setFilter({ ...filter, group: e.target.value })}><option value="category">Category</option><option value="entry_type">Expense type</option></select></label><button className="primary" disabled={busy}>Analyse</button></form>
    {error && <p className="error" role="alert">{error}</p>}{busy ? <p role="status">Loading analysis…</p> : <section className="panel record-list">{items.length ? items.map((item, i) => <article className="record" key={i}><div><strong>{item.category}</strong><small>{item.transaction_count} entries</small></div><strong>{item.amount} {item.currency}</strong></article>) : <p>No expenses in this period.</p>}</section>}
  </div>;
}
