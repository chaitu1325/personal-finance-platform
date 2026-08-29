import { useEffect, useMemo, useState } from 'react';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1').replace(/\/$/, '');

const MODULES = [
  { key: 'dashboard', label: 'Dashboard', endpoint: '/dashboard', icon: '⌂' },
  { key: 'transactions', label: 'Income & expenses', endpoint: '/transactions', icon: '↕' },
  { key: 'persons', label: 'Family', endpoint: '/persons', icon: '♧' },
  { key: 'properties', label: 'Rentals', endpoint: '/properties', icon: '⌂' },
  { key: 'investments', label: 'Investments', endpoint: '/investments', icon: '↗' },
  { key: 'assets', label: 'Assets', endpoint: '/assets', icon: '◆' },
  { key: 'liabilities', label: 'Liabilities', endpoint: '/liabilities', icon: '−' },
  { key: 'budgets', label: 'Budgets', endpoint: '/budgets', icon: '▤' },
  { key: 'goals', label: 'Goals', endpoint: '/goals', icon: '◎' }
];

const FORM_FIELDS = {
  transactions: [
    { name: 'account_id', label: 'Account ID', type: 'number', required: true },
    { name: 'transaction_type', label: 'Type', type: 'select', options: ['INCOME', 'EXPENSE', 'TRANSFER'], required: true },
    { name: 'amount', label: 'Amount', type: 'number', step: '0.01', required: true },
    { name: 'transaction_date', label: 'Date', type: 'date', required: true },
    { name: 'description', label: 'Description', type: 'text' }
  ],
  persons: [
    { name: 'full_name', label: 'Full name', type: 'text', required: true },
    { name: 'relationship', label: 'Relationship', type: 'text' },
    { name: 'phone', label: 'Phone', type: 'text' },
    { name: 'email', label: 'Email', type: 'email' }
  ],
  properties: [
    { name: 'property_name', label: 'Property name', type: 'text', required: true },
    { name: 'property_type', label: 'Type', type: 'select', options: ['RESIDENTIAL', 'COMMERCIAL', 'LAND', 'OTHER'], required: true },
    { name: 'current_value', label: 'Current value', type: 'number', step: '0.01' },
    { name: 'units_count', label: 'Units', type: 'number' },
    { name: 'city', label: 'City', type: 'text' }
  ],
  investments: [
    { name: 'name', label: 'Investment name', type: 'text', required: true },
    { name: 'investment_type', label: 'Type', type: 'select', options: ['STOCK', 'MF', 'BOND', 'ETF', 'CRYPTO', 'FD', 'OTHER'], required: true },
    { name: 'symbol', label: 'Symbol', type: 'text' },
    { name: 'quantity', label: 'Quantity', type: 'number', step: '0.00000001' },
    { name: 'current_price', label: 'Current price', type: 'number', step: '0.01' }
  ],
  assets: [
    { name: 'name', label: 'Asset name', type: 'text', required: true },
    { name: 'asset_type', label: 'Type', type: 'select', options: ['REAL_ESTATE', 'VEHICLE', 'ELECTRONICS', 'JEWELLERY', 'CASH', 'OTHER'], required: true },
    { name: 'current_value', label: 'Current value', type: 'number', step: '0.01' },
    { name: 'purchase_date', label: 'Purchase date', type: 'date' }
  ],
  liabilities: [
    { name: 'name', label: 'Liability name', type: 'text', required: true },
    { name: 'liability_type', label: 'Type', type: 'select', options: ['LOAN', 'CREDIT_CARD', 'MORTGAGE', 'PERSONAL', 'OTHER'], required: true },
    { name: 'original_amount', label: 'Original amount', type: 'number', step: '0.01', required: true },
    { name: 'outstanding_amount', label: 'Outstanding amount', type: 'number', step: '0.01', required: true },
    { name: 'lender', label: 'Lender', type: 'text' }
  ],
  budgets: [
    { name: 'period_start', label: 'Start date', type: 'date', required: true },
    { name: 'period_end', label: 'End date', type: 'date', required: true },
    { name: 'amount', label: 'Budget amount', type: 'number', step: '0.01', required: true },
    { name: 'category_id', label: 'Category ID (optional)', type: 'number' }
  ],
  goals: [
    { name: 'name', label: 'Goal name', type: 'text', required: true },
    { name: 'target_amount', label: 'Target amount', type: 'number', step: '0.01', required: true },
    { name: 'current_amount', label: 'Current amount', type: 'number', step: '0.01' },
    { name: 'target_date', label: 'Target date', type: 'date' }
  ]
};

function formatMoney(value) {
  var number = Number(value || 0);
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(number);
}

async function requestApi(path, options, token) {
  options = options || {};
  var headers = Object.assign({ Accept: 'application/json' }, options.headers || {});
  if (token) headers.Authorization = 'Bearer ' + token;
  var init = Object.assign({}, options, { headers: headers });
  if (init.body && typeof init.body !== 'string') {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(init.body);
  }
  var response = await fetch(API_BASE + path, init);
  var payload = await response.json().catch(function () { return {}; });
  if (!response.ok) {
    var message = payload && payload.error && payload.error.message
      ? payload.error.message
      : 'Request failed (' + response.status + ')';
    throw new Error(message);
  }
  return payload.data === undefined ? payload : payload.data;
}

function Field({ field, value, onChange }) {
  var common = {
    id: field.name,
    name: field.name,
    value: value || '',
    required: field.required,
    onChange: function (event) { onChange(field.name, event.target.value); }
  };
  if (field.type === 'select') {
    return (
      <label className="field">
        <span>{field.label}</span>
        <select {...common}>
          <option value="">Choose…</option>
          {field.options.map(function (option) { return <option key={option} value={option}>{option}</option>; })}
        </select>
      </label>
    );
  }
  return (
    <label className="field">
      <span>{field.label}</span>
      <input {...common} type={field.type} step={field.step} />
    </label>
  );
}

function AuthScreen({ onAuthenticated }) {
  var [mode, setMode] = useState('login');
  var [form, setForm] = useState({ email: '', password: '', display_name: '' });
  var [error, setError] = useState('');
  var [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      var path = mode === 'login' ? '/auth/login' : '/auth/register';
      var result = await requestApi(path, { method: 'POST', body: form }, null);
      onAuthenticated(result);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand-mark">PF</div>
        <p className="eyebrow">Personal finance platform</p>
        <h1>{mode === 'login' ? 'Welcome back' : 'Create your family workspace'}</h1>
        <p className="muted">Track cash flow, property, investments, assets and liabilities in one place.</p>
        <form onSubmit={submit}>
          {mode === 'register' && (
            <label className="field"><span>Display name</span><input required value={form.display_name} onChange={function (e) { setForm(Object.assign({}, form, { display_name: e.target.value })); }} /></label>
          )}
          <label className="field"><span>Email</span><input type="email" required value={form.email} onChange={function (e) { setForm(Object.assign({}, form, { email: e.target.value })); }} /></label>
          <label className="field"><span>Password</span><input type="password" required minLength="8" value={form.password} onChange={function (e) { setForm(Object.assign({}, form, { password: e.target.value })); }} /></label>
          {error && <p className="error">{error}</p>}
          <button className="primary full" disabled={busy}>{busy ? 'Working…' : (mode === 'login' ? 'Sign in' : 'Create account')}</button>
        </form>
        <button className="link-button" onClick={function () { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
          {mode === 'login' ? 'Need an account? Register' : 'Already registered? Sign in'}
        </button>
      </section>
    </main>
  );
}

function Dashboard({ token, user }) {
  var [dashboard, setDashboard] = useState(null);
  var [error, setError] = useState('');
  useEffect(function () {
    requestApi('/dashboard', {}, token).then(setDashboard).catch(function (e) { setError(e.message); });
  }, [token]);

  if (error) return <p className="error">{error}</p>;
  if (!dashboard) return <p className="muted">Loading your dashboard…</p>;
  var summary = dashboard.summary || {};
  var netWorth = dashboard.net_worth || {};
  return (
    <div>
      <div className="welcome">
        <div><p className="eyebrow">Overview</p><h1>Good to see you, {user.display_name}</h1><p className="muted">Your financial picture for {dashboard.period.from} to {dashboard.period.to}.</p></div>
        <span className="status-pill">API connected</span>
      </div>
      <div className="metric-grid">
        <article className="metric-card"><span>Income</span><strong>{formatMoney(summary.income)}</strong><small>Selected period</small></article>
        <article className="metric-card"><span>Expenses</span><strong>{formatMoney(summary.expenses)}</strong><small>Selected period</small></article>
        <article className="metric-card accent"><span>Net cash flow</span><strong>{formatMoney(summary.net_cash_flow)}</strong><small>{summary.transaction_count || 0} transactions</small></article>
        <article className="metric-card"><span>Net worth</span><strong>{formatMoney(netWorth.total)}</strong><small>Assets minus liabilities</small></article>
      </div>
      <div className="two-column">
        <section className="panel"><div className="panel-heading"><h2>Accounts</h2><span>{(dashboard.accounts || []).length}</span></div>
          {(dashboard.accounts || []).length === 0 ? <p className="muted">Add a cash or bank account to see balances.</p> : <div className="rows">{dashboard.accounts.map(function (account) { return <div className="row" key={account.id}><span>{account.name}<small>{account.account_type}</small></span><strong>{formatMoney(account.balance)} {account.currency}</strong></div>; })}</div>}
        </section>
        <section className="panel"><div className="panel-heading"><h2>Net worth mix</h2></div>
          <div className="rows"><div className="row"><span>Assets</span><strong>{formatMoney(netWorth.assets)}</strong></div><div className="row"><span>Properties</span><strong>{formatMoney(netWorth.properties)}</strong></div><div className="row"><span>Investments</span><strong>{formatMoney(netWorth.investments)}</strong></div><div className="row negative"><span>Liabilities</span><strong>− {formatMoney(netWorth.liabilities)}</strong></div></div>
        </section>
      </div>
    </div>
  );
}

function ResourceView({ module, token }) {
  var fields = FORM_FIELDS[module.key] || [];
  var [items, setItems] = useState([]);
  var [form, setForm] = useState({});
  var [busy, setBusy] = useState(false);
  var [error, setError] = useState('');
  var [showForm, setShowForm] = useState(false);

  function load() {
    setError('');
    requestApi(module.endpoint, {}, token).then(function (result) {
      setItems(Array.isArray(result) ? result : (result.items || []));
    }).catch(function (e) { setError(e.message); });
  }
  useEffect(load, [module.key, token]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    var body = Object.assign({}, form);
    Object.keys(body).forEach(function (key) {
      if (body[key] === '') delete body[key];
      else if (/(_id|amount|value|quantity|units|bedrooms)$/.test(key) && !isNaN(Number(body[key]))) body[key] = Number(body[key]);
    });
    try {
      await requestApi(module.endpoint, { method: 'POST', body: body }, token);
      setForm({});
      setShowForm(false);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="welcome"><div><p className="eyebrow">Module</p><h1>{module.label}</h1><p className="muted">Create and review family-scoped records. IDs shown here are safe to use in related forms.</p></div><button className="primary" onClick={function () { setShowForm(!showForm); }}>{showForm ? 'Close' : 'Add record'}</button></div>
      {showForm && <section className="panel form-panel"><div className="panel-heading"><h2>New {module.label.toLowerCase().replace(' & expenses', ' transaction')}</h2><span>POST {module.endpoint}</span></div><form className="form-grid" onSubmit={submit}>{fields.map(function (field) { return <Field key={field.name} field={field} value={form[field.name]} onChange={function (name, value) { setForm(Object.assign({}, form, { [name]: value })); }} />; })}<div className="form-actions"><button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save record'}</button></div></form></section>}
      {error && <p className="error">{error}</p>}
      <section className="panel"><div className="panel-heading"><h2>Recent records</h2><button className="quiet-button" onClick={load}>Refresh</button></div>
        {items.length === 0 ? <p className="muted">No records yet. Use Add record to get started.</p> : <div className="record-list">{items.map(function (item) { return <article className="record" key={item.id}><div><strong>{item.name || item.full_name || item.property_name || item.description || ('Record #' + item.id)}</strong><small>{item.transaction_type || item.status || item.asset_type || item.investment_type || ''}</small></div><strong>{item.amount !== undefined ? formatMoney(item.amount) : item.current_value !== undefined ? formatMoney(item.current_value) : item.target_amount !== undefined ? formatMoney(item.target_amount) : ''}</strong></article>; })}</div>}
      </section>
    </div>
  );
}

export default function App() {
  var [token, setToken] = useState(function () { return localStorage.getItem('pf_token') || ''; });
  var [user, setUser] = useState(function () { try { return JSON.parse(localStorage.getItem('pf_user') || 'null'); } catch (e) { return null; } });
  var [active, setActive] = useState('dashboard');
  var [apiStatus, setApiStatus] = useState('checking');

  useEffect(function () {
    fetch(API_BASE + '/health').then(function (response) { setApiStatus(response.ok ? 'online' : 'degraded'); }).catch(function () { setApiStatus('offline'); });
  }, []);

  function authenticated(result) {
    setToken(result.token);
    setUser(result.user);
    localStorage.setItem('pf_token', result.token);
    localStorage.setItem('pf_user', JSON.stringify(result.user));
  }

  function logout() {
    setToken('');
    setUser(null);
    localStorage.removeItem('pf_token');
    localStorage.removeItem('pf_user');
  }

  if (!token || !user) return <AuthScreen onAuthenticated={authenticated} />;
  var currentModule = MODULES.find(function (module) { return module.key === active; }) || MODULES[0];

  return (
    <div className="app-shell">
      <aside className="sidebar"><div className="brand"><div className="brand-mark">PF</div><div><strong>Personal Finance</strong><small>Family workspace</small></div></div><nav>{MODULES.map(function (module) { return <button className={active === module.key ? 'nav-item active' : 'nav-item'} key={module.key} onClick={function () { setActive(module.key); }}><span>{module.icon}</span>{module.label}</button>; })}</nav><div className="sidebar-footer"><span className={apiStatus === 'online' ? 'dot online' : 'dot'}></span>API {apiStatus}<button className="link-button" onClick={logout}>Sign out</button></div></aside>
      <main className="content"><header className="topbar"><span className="mobile-title">Personal Finance</span><span className="user-chip">{user.display_name}</span></header>{active === 'dashboard' ? <Dashboard token={token} user={user} /> : <ResourceView module={currentModule} token={token} />}</main>
    </div>
  );
}
