import { useEffect, useMemo, useState } from 'react';
import { createApi } from '../../../packages/finance-core/index.js';
import { ExpenseAnalysis, Workspace } from './Workspace.jsx';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1').replace(/\/$/, '');
const requestApi = (path, options, token) => createApi(API_BASE, () => token)(path, options);

function formatMoney(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(Number(value || 0));
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

function Dashboard({ token, user, onNavigate }) {
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
        <section className="panel"><div className="panel-heading"><h2>Accounts</h2><button className="quiet-button" onClick={() => onNavigate('accounts')}>Manage accounts</button></div>
          {(dashboard.accounts || []).length === 0 ? <p className="muted">Add a cash or bank account to see balances.</p> : <div className="rows">{dashboard.accounts.map(function (account) { return <div className="row" key={account.id}><span>{account.name}<small>{account.account_type}</small></span><strong>{formatMoney(account.balance)} {account.currency}</strong></div>; })}</div>}
        </section>
        <section className="panel"><div className="panel-heading"><h2>Net worth mix</h2></div>
          <div className="rows"><div className="row"><span>Assets</span><strong>{formatMoney(netWorth.assets)}</strong></div><div className="row"><span>Properties</span><strong>{formatMoney(netWorth.properties)}</strong></div><div className="row"><span>Investments</span><strong>{formatMoney(netWorth.investments)}</strong></div><div className="row negative"><span>Liabilities</span><strong>− {formatMoney(netWorth.liabilities)}</strong></div></div>
        </section>
      </div>
    </div>
  );
}

export default function App() {
  var [token, setToken] = useState(function () { return localStorage.getItem('pf_token') || ''; });
  var [user, setUser] = useState(function () { try { return JSON.parse(localStorage.getItem('pf_user') || 'null'); } catch (e) { return null; } });
  var [active, setActive] = useState('dashboard');
  var [apiStatus, setApiStatus] = useState('checking');
  const [catalog, setCatalog] = useState([]);
  const [catalogError, setCatalogError] = useState('');
  const [catalogRevision, setCatalogRevision] = useState(0);
  const api = useMemo(() => createApi(API_BASE, () => token), [token]);
  useEffect(() => {
    if (!token) return;
    let live = true;
    setCatalogError('');
    api('/catalog').then(result => { if (live) setCatalog(result.modules); }).catch(e => { if (live) setCatalogError(e.message); });
    return () => { live = false; };
  }, [api, token, catalogRevision]);
  const modules = [{ key: 'dashboard', label: 'Dashboard' }, ...catalog, { key: 'analysis', label: 'Expense analysis' }];

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
    setActive('dashboard');
    setCatalog([]);
    setToken('');
    setUser(null);
    localStorage.removeItem('pf_token');
    localStorage.removeItem('pf_user');
  }

  if (!token || !user) return <AuthScreen onAuthenticated={authenticated} />;
  var currentModule = catalog.find(module => module.key === active);

  return (
    <div className="app-shell">
      <aside className="sidebar"><div className="brand"><div className="brand-mark">PF</div><div><strong>Personal Finance</strong><small>Family workspace</small></div></div><nav>{modules.map(function (module) { return <button className={active === module.key ? 'nav-item active' : 'nav-item'} key={module.key} onClick={function () { setActive(module.key); }}><span>{module.key === 'dashboard' ? '⌂' : '▤'}</span>{module.label}</button>; })}</nav><div className="sidebar-footer"><span className={apiStatus === 'online' ? 'dot online' : 'dot'}></span>API {apiStatus}<button className="link-button" onClick={logout}>Sign out</button></div></aside>
      <main className="content"><header className="topbar"><span className="mobile-title">Personal Finance</span><span className="user-chip">{user.display_name}</span></header>{catalogError && <div><p className="error" role="alert">{catalogError}</p><button onClick={() => setCatalogRevision(r => r + 1)}>Retry loading modules</button></div>}
        {active === 'dashboard' ? <Dashboard token={token} user={user} onNavigate={setActive} /> : active === 'analysis' ? <ExpenseAnalysis api={api} /> : currentModule ? <Workspace key={currentModule.key} module={currentModule} api={api} onNavigate={setActive} /> : <p>Loading module…</p>}</main>
    </div>
  );
}
