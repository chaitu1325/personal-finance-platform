import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { changeField, choices, formPayload, initialForm, label, loadCollection, recordName, validateUpload } from '../../packages/finance-core/index.js';

export function Action({ children, onPress, disabled = false }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[s.button, disabled && s.disabled]}><Text style={s.buttonText}>{children}</Text></Pressable>;
}

export function Choice({ title, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selected = options.find(o => String(o.value) === String(value));
  return <View><Text style={s.label}>{title}</Text><Pressable accessibilityRole="button" accessibilityLabel={title} onPress={() => { setOpen(true); setSearch(''); }} style={s.input}><Text>{selected?.label || 'Choose…'}</Text></Pressable>
    <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}><View style={s.overlay}><View style={s.modal}>
      <Text style={s.heading}>{title}</Text><TextInput accessibilityLabel="Search options" placeholder="Search options" value={search} onChangeText={setSearch} style={s.input} />
      <ScrollView keyboardShouldPersistTaps="handled"><Action onPress={() => { onChange(''); setOpen(false); }}>Clear selection</Action>{options.filter(o => o.label.toLowerCase().includes(search.toLowerCase())).map(o => <Pressable accessibilityRole="button" key={o.value} style={s.option} onPress={() => { onChange(o.value); setOpen(false); }}><Text>{o.label}</Text></Pressable>)}</ScrollView>
      <Action onPress={() => setOpen(false)}>Close</Action></View></View></Modal>
  </View>;
}

function MobileField({ field, form, refs, module, onChange }) {
  const title = field.label + (field.required ? ' *' : ' (optional)');
  if (['select', 'reference'].includes(field.type)) return <Choice title={title} value={form[field.name]} options={choices(field, form, refs, module.key)} onChange={value => onChange(field.name, value)} />;
  return <View><Text style={s.label}>{title}</Text><TextInput accessibilityLabel={title} style={[s.input, field.type === 'textarea' && s.multiline]} value={String(form[field.name] ?? '')} onChangeText={value => onChange(field.name, value)}
    placeholder={field.type === 'date' ? 'YYYY-MM-DD' : field.name === 'institution' ? 'SBI, ICICI…' : ''} maxLength={field.maxLength}
    autoCapitalize="none" keyboardType={field.type === 'decimal' || field.type === 'integer' ? 'numbers-and-punctuation' : 'default'} multiline={field.type === 'textarea'} /></View>;
}

export function MobileWorkspace({ module, api, onNavigate, onScrollTop }) {
  const [items, setItems] = useState([]);
  const [refs, setRefs] = useState({});
  const [form, setForm] = useState(() => initialForm(module));
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [revision, setRevision] = useState(0);
  const [filter, setFilter] = useState({ type: '', from: '', to: '', category: '' });
  const running = useRef(false);
  const query = Object.entries(filter).filter(([, v]) => v).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
  const path = module.endpoint + (module.key === 'transactions' && query ? '?' + query : '');
  useEffect(() => {
    let live = true;
    setLoading(true); setError('');
    const resources = [...new Set(module.fields.filter(f => f.resource).map(f => f.resource))];
    Promise.all([loadCollection(api, path), Promise.all(resources.map(async key => [key, await loadCollection(api, '/' + key)]))])
      .then(([rows, related]) => { if (live) { setItems(rows); setRefs(Object.fromEntries(related)); } })
      .catch(e => { if (live) setError(e.message); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [module, api, path, revision]);
  const needsAccount = ['transactions', 'recurring-transactions'].includes(module.key) && !loading && !error && !(refs.accounts || []).some(a => a.status === 'ACTIVE');

  async function save() {
    if (running.current) return;
    running.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const body = formPayload(module, form, Boolean(editing));
      await api(module.endpoint + (editing ? '?id=' + editing.id : ''), { method: editing ? 'PATCH' : 'POST', body });
      setOpen(false); setEditing(null); setForm(initialForm(module)); setMessage('Saved successfully.'); setRevision(r => r + 1);
    } catch (e) { setError(e.message); }
    finally { running.current = false; setBusy(false); }
  }
  async function processDue() {
    if (running.current) return;
    running.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const result = await api('/recurring-run', { method: 'POST', body: {} });
      setMessage(`Posted ${result.created} due entries. ${result.pending_schedules} schedules still due.${result.skipped.length ? ' Skipped: ' + result.skipped.map(x => '#' + x.id + ' ' + x.message).join('; ') : ''}`);
      setRevision(r => r + 1);
    } catch (e) { setError(e.message); }
    finally { running.current = false; setBusy(false); }
  }
  return <View><Text style={s.heading}>{module.label}</Text>
    {module.key === 'transactions' && <View style={s.card}><Text style={s.label}>Filter entries</Text><Choice title="Direction" value={filter.type} options={['INCOME', 'EXPENSE'].map(value => ({ value, label: label(value) }))} onChange={type => setFilter({ ...filter, type, category: '' })} />
      <Choice title="Category" value={filter.category} options={(refs.categories || []).filter(c => !filter.type || c.category_type === filter.type).map(c => ({ value: String(c.id), label: c.name }))} onChange={category => setFilter({ ...filter, category })} />
      {['from', 'to'].map(key => <View key={key}><Text style={s.label}>{label(key)} (YYYY-MM-DD)</Text><TextInput accessibilityLabel={label(key)} value={filter[key]} onChangeText={value => setFilter({ ...filter, [key]: value })} style={s.input} placeholder="YYYY-MM-DD" /></View>)}
    </View>}
    <Action disabled={busy || loading} onPress={() => { setEditing(null); setForm(initialForm(module)); setOpen(!open); }}>{open ? 'Close form' : 'Add record'}</Action>
    {['transactions', 'recurring-transactions'].includes(module.key) && <View><Action onPress={() => onNavigate('categories')}>Manage categories</Action><Action onPress={() => onNavigate('recurring-transactions')}>Recurring schedules</Action><Action onPress={() => onNavigate('analysis')}>Expense analysis</Action><Action disabled={busy} onPress={processDue}>Process due entries</Action></View>}
    {needsAccount && <View style={s.card}><Text>Create an active account first.</Text><Action onPress={() => onNavigate('accounts')}>Go to Accounts</Action></View>}
    {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}{message ? <Text accessibilityLiveRegion="polite" style={s.message}>{message}</Text> : null}
    {open && (!needsAccount || editing) && <View style={s.card} pointerEvents={busy ? 'none' : 'auto'}><Text style={s.heading}>{editing ? `Edit record #${editing.id}` : 'New record'}</Text><Text style={s.hint}>* Required. Optional values can be left blank. Dates use YYYY-MM-DD.</Text>
      {['transactions', 'recurring-transactions'].includes(module.key) && <Text style={s.hint}>Recurring schedules create recorded entries when processed or when the server job runs. No bank payments are made.</Text>}
      {module.fields.filter(f => !(editing && f.create_only) && !(f.name === 'end_date' && form.frequency === 'ONETIME')).map(field => <MobileField key={field.name} field={field} form={form} refs={refs} module={module} onChange={(name, value) => setForm(current => changeField(current, name, value, module))} />)}
      <Action disabled={busy || loading} onPress={save}>{busy ? 'Saving…' : 'Save record'}</Action></View>}
    <MobileImport module={module} api={api} onImported={() => setRevision(r => r + 1)} />
    <Action disabled={busy || loading} onPress={() => setRevision(r => r + 1)}>Refresh records</Action>
    {loading ? <ActivityIndicator color="#173c2a" /> : !items.length ? <Text style={s.hint}>No records found.</Text> : items.map(item => <View style={s.card} key={item.id}><Text style={s.label}>{recordName(item)}</Text><Text style={s.hint}>#{item.id} · {[item.transaction_type, item.entry_type, item.frequency, item.status, item.is_active === 0 ? 'PAUSED' : '', item.transaction_date, item.next_run_date].filter(Boolean).map(label).join(' · ')}</Text>
      {item.institution ? <Text>{item.institution}</Text> : null}{module.key === 'accounts' && item.description ? <Text>{item.description}</Text> : null}
      {item.category_id ? <Text>Category: {(refs.categories || []).find(c => String(c.id) === String(item.category_id))?.name || '#' + item.category_id}</Text> : null}
      <Text>{item.amount ?? item.opening_balance ?? item.current_value ?? item.target_amount ?? ''} {item.currency || ''}</Text>
      {!(module.key === 'categories' && item.family_id === null) && <Action disabled={busy} onPress={() => { setEditing(item); setForm(initialForm(module, item)); setOpen(true); onScrollTop?.(); }}>Edit</Action>}
    </View>)}
  </View>;
}

function MobileImport({ module, api, onImported }) {
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState('');
  const [name, setName] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const running = useRef(false);
  async function pick() {
    if (running.current) return;
    running.current = true; setBusy(true); setError(''); setPreview(null); setCsv(''); setMessage(''); setName('');
    let cacheUri;
    try {
      const selected = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: false, copyToCacheDirectory: true });
      if (selected.canceled) return;
      const file = selected.assets[0];
      if (file.uri.startsWith(FileSystem.cacheDirectory)) cacheUri = file.uri;
      const info = await FileSystem.getInfoAsync(file.uri);
      validateUpload(file.name, file.size ?? info.size ?? Infinity);
      const text = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.UTF8 });
      setCsv(text); setName(file.name);
    } catch (e) { setError(e.message); }
    finally {
      if (cacheUri) await FileSystem.deleteAsync(cacheUri, { idempotent: true }).catch(() => {});
      running.current = false; setBusy(false);
    }
  }
  async function template(direction) {
    if (running.current) return;
    running.current = true; setBusy(true); setError('');
    let cacheUri;
    try {
      if (!await Sharing.isAvailableAsync()) throw new Error('File sharing is unavailable on this device');
      const sample = await api(`/imports?resource=${module.key}&direction=${direction}`);
      cacheUri = FileSystem.cacheDirectory + sample.filename;
      await FileSystem.writeAsStringAsync(cacheUri, sample.csv, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(cacheUri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text', dialogTitle: 'Save sample CSV template' });
    } catch (e) { setError(e.message); }
    finally {
      if (cacheUri) await FileSystem.deleteAsync(cacheUri, { idempotent: true }).catch(() => {});
      running.current = false; setBusy(false);
    }
  }
  async function send(action) {
    if (running.current) return;
    running.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const result = await api('/imports', { method: 'POST', body: { resource: module.key, csv, action } });
      if (action === 'preview') { setPreview(result); if (result.already_imported) setMessage('Already imported; confirming will not add duplicates.'); }
      else { setMessage(result.already_imported ? 'Already imported; no duplicates added.' : `Imported ${result.imported} records.`); setCsv(''); setPreview(null); onImported(); }
    } catch (e) { setError(e.message); setPreview(null); }
    finally { running.current = false; setBusy(false); }
  }
  return <View style={s.card}><Action onPress={() => setOpen(!open)}>Bulk upload / sample CSV</Action>{open && <View><Text style={s.hint}>UTF-8 CSV, up to 1 MB / 200 rows. Replace reference placeholders such as ACCOUNT_ID with IDs shown in your records. Import related records first.</Text>
    <Action disabled={busy} onPress={() => template('INCOME')}>Save / share sample template</Action>{['transactions', 'recurring-transactions'].includes(module.key) && <Action disabled={busy} onPress={() => template('EXPENSE')}>Expense sample template</Action>}
    <Action disabled={busy} onPress={pick}>Choose CSV file</Action>{name ? <Text>{name}</Text> : null}
    <Action disabled={busy || !csv} onPress={() => send('preview')}>Validate & preview</Action>
    {preview && <View><Text>{preview.row_count} rows. {preview.valid ? 'Ready to import.' : 'Correct the errors and select the file again.'}</Text>{preview.errors.map((e, i) => <Text key={i} style={s.error}>Row {e.row}: {e.message}</Text>)}{preview.preview.map((row, i) => <Text key={i} style={s.preview}>{JSON.stringify(row, null, 2)}</Text>)}{preview.valid && <Action disabled={busy} onPress={() => send('commit')}>Confirm import ({preview.row_count} rows)</Action>}</View>}
    {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}{message ? <Text accessibilityLiveRegion="polite" style={s.message}>{message}</Text> : null}
  </View>}</View>;
}

export function MobileAnalysis({ api }) {
  const [filter, setFilter] = useState({ from: new Date().toISOString().slice(0, 7) + '-01', to: new Date().toISOString().slice(0, 10), group: 'category' });
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function load() {
    setBusy(true); setError('');
    try { const result = await api('/reports?type=spending&' + Object.entries(filter).map(([key, value]) => key + '=' + encodeURIComponent(value)).join('&')); setItems(result.items); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  useEffect(() => { load(); }, [api]);
  return <View><Text style={s.heading}>Expense analysis</Text><Text style={s.hint}>Recorded expenses by category or type, separated by currency.</Text>
    {['from', 'to'].map(key => <View key={key}><Text style={s.label}>{label(key)}</Text><TextInput accessibilityLabel={label(key)} placeholder="YYYY-MM-DD" value={filter[key]} onChangeText={value => setFilter({ ...filter, [key]: value })} style={s.input} /></View>)}
    <Choice title="Group by" value={filter.group} options={[{ value: 'category', label: 'Category' }, { value: 'entry_type', label: 'Expense type' }]} onChange={group => setFilter({ ...filter, group: group || 'category' })} />
    <Action disabled={busy} onPress={load}>Analyse</Action>{busy && <ActivityIndicator />}{error ? <Text style={s.error}>{error}</Text> : null}
    {!busy && !items.length && <Text>No expenses in this period.</Text>}{!busy && items.map((item, i) => <View key={i} style={s.card}><Text style={s.label}>{item.category}</Text><Text>{item.amount} {item.currency}</Text><Text style={s.hint}>{item.transaction_count} entries</Text></View>)}
  </View>;
}

const s = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginVertical: 10 },
  heading: { color: '#173c2a', fontSize: 23, fontWeight: '800', marginBottom: 10 },
  label: { color: '#244633', fontWeight: '700', marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#b8cbbb', borderRadius: 8, padding: 12, color: '#173c2a', backgroundColor: '#fff', minHeight: 46 },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  button: { backgroundColor: '#173c2a', borderRadius: 8, padding: 12, marginVertical: 6, minHeight: 44 },
  buttonText: { color: '#fff', fontWeight: '700', textAlign: 'center' }, disabled: { opacity: 0.5 },
  hint: { color: '#54685a', marginVertical: 6, lineHeight: 20 }, error: { color: '#a02e22', paddingVertical: 12 },
  message: { color: '#226133', paddingVertical: 12 }, preview: { fontSize: 11, backgroundColor: '#f3f6f2', padding: 10, marginVertical: 5 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20 },
  modal: { backgroundColor: '#fff', borderRadius: 16, padding: 20, maxHeight: '80%' },
  option: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#e5ece4' }
});
