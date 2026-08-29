import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';

const API_BASE = (process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8080/api/v1').replace(/\/$/, '');
const MODULES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'transactions', label: 'Income & expenses' },
  { key: 'persons', label: 'Family' },
  { key: 'properties', label: 'Rentals' },
  { key: 'investments', label: 'Investments' },
  { key: 'assets', label: 'Assets' },
  { key: 'liabilities', label: 'Liabilities' }
];

async function api(path, options, token) {
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
  if (!response.ok) throw new Error(payload.error && payload.error.message ? payload.error.message : 'Request failed');
  return payload.data === undefined ? payload : payload.data;
}

function Auth({ onLogin }) {
  var [email, setEmail] = useState('');
  var [password, setPassword] = useState('');
  var [busy, setBusy] = useState(false);
  var [error, setError] = useState('');

  async function submit() {
    setBusy(true);
    setError('');
    try {
      var result = await api('/auth/login', { method: 'POST', body: { email: email, password: password } });
      onLogin(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.authPage}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.authCard}>
        <Text style={styles.logo}>PF</Text>
        <Text style={styles.eyebrow}>PERSONAL FINANCE</Text>
        <Text style={styles.title}>Your family money, clearly organised.</Text>
        <Text style={styles.muted}>Sign in to view cash flow, rentals, investments, assets and liabilities.</Text>
        <TextInput autoCapitalize="none" keyboardType="email-address" placeholder="Email" value={email} onChangeText={setEmail} style={styles.input} />
        <TextInput secureTextEntry placeholder="Password" value={password} onChangeText={setPassword} style={styles.input} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={styles.primary} onPress={submit} disabled={busy}><Text style={styles.primaryText}>{busy ? 'Signing in…' : 'Sign in'}</Text></Pressable>
        <Text style={styles.helper}>Create an account from the web app first.</Text>
      </View>
    </SafeAreaView>
  );
}

function App() {
  var [session, setSession] = useState(null);
  var [active, setActive] = useState('dashboard');
  var [dashboard, setDashboard] = useState(null);
  var [error, setError] = useState('');
  var [loading, setLoading] = useState(false);

  useEffect(function () {
    if (!session) return;
    setLoading(true);
    var path = active === 'dashboard' ? '/dashboard' : '/' + active;
    api(path, {}, session.token).then(function (result) {
      setDashboard(result);
      setError('');
    }).catch(function (e) { setError(e.message); }).finally(function () { setLoading(false); });
  }, [active, session]);

  if (!session) return <Auth onLogin={setSession} />;
  var summary = dashboard && dashboard.summary ? dashboard.summary : {};
  var netWorth = dashboard && dashboard.net_worth ? dashboard.net_worth : {};
  var records = dashboard && dashboard.items ? dashboard.items : [];

  return (
    <SafeAreaView style={styles.page}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}><View><Text style={styles.eyebrow}>PERSONAL FINANCE</Text><Text style={styles.headerTitle}>{session.user.display_name}</Text></View><Pressable onPress={function () { setSession(null); }}><Text style={styles.signOut}>Sign out</Text></Pressable></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs} contentContainerStyle={styles.tabsContent}>{MODULES.map(function (module) { return <Pressable key={module.key} onPress={function () { setActive(module.key); }} style={active === module.key ? styles.tabActive : styles.tab}><Text style={active === module.key ? styles.tabTextActive : styles.tabText}>{module.label}</Text></Pressable>; })}</ScrollView>
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? <ActivityIndicator color="#173c2a" /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {active === 'dashboard' ? <View><Text style={styles.pageTitle}>Overview</Text><Text style={styles.muted}>A compact view of your family workspace.</Text><View style={styles.metrics}><Metric label="Income" value={summary.income} /><Metric label="Expenses" value={summary.expenses} /><Metric label="Net cash flow" value={summary.net_cash_flow} /><Metric label="Net worth" value={netWorth.total} /></View><Text style={styles.sectionTitle}>Net worth mix</Text><View style={styles.card}><Line label="Assets" value={netWorth.assets} /><Line label="Properties" value={netWorth.properties} /><Line label="Investments" value={netWorth.investments} /><Line label="Liabilities" value={netWorth.liabilities} /></View></View> : <View><Text style={styles.pageTitle}>{MODULES.find(function (module) { return module.key === active; }).label}</Text><Text style={styles.muted}>Use the web app for create and edit forms. This mobile view is ready for read-only dashboards and alerts.</Text>{records.length === 0 ? <View style={styles.card}><Text style={styles.muted}>No records returned yet.</Text></View> : records.map(function (record) { return <View style={styles.card} key={record.id}><Text style={styles.recordTitle}>{record.name || record.full_name || record.description || 'Record #' + record.id}</Text><Text style={styles.muted}>{record.status || record.transaction_type || ''}</Text></View>; })}</View>}
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ label, value }) {
  return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value || '0'}</Text></View>;
}
function Line({ label, value }) {
  return <View style={styles.line}><Text style={styles.lineLabel}>{label}</Text><Text style={styles.lineValue}>{value || '0'}</Text></View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f3f6f2' },
  authPage: { flex: 1, justifyContent: 'center', padding: 22, backgroundColor: '#f3f6f2' },
  authCard: { borderRadius: 20, padding: 25, backgroundColor: '#ffffff' },
  logo: { alignSelf: 'flex-start', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: '#c8e86c', color: '#173c2a', fontWeight: '800', fontSize: 18 },
  eyebrow: { marginTop: 18, color: '#6c8976', fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  title: { marginTop: 8, color: '#173c2a', fontSize: 29, fontWeight: '800', lineHeight: 34 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 10 },
  headerTitle: { marginTop: 3, color: '#173c2a', fontSize: 22, fontWeight: '800' },
  signOut: { color: '#2e6b43', fontWeight: '700' },
  muted: { marginTop: 8, color: '#718275', lineHeight: 20 },
  input: { marginTop: 14, borderWidth: 1, borderColor: '#d7e3d9', borderRadius: 9, padding: 12, color: '#173c2a', backgroundColor: '#fff' },
  primary: { marginTop: 16, borderRadius: 9, padding: 13, alignItems: 'center', backgroundColor: '#173c2a' },
  primaryText: { color: '#fff', fontWeight: '800' },
  helper: { marginTop: 15, textAlign: 'center', color: '#87988c', fontSize: 12 },
  error: { marginTop: 13, color: '#aa503e' },
  tabs: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: '#e0e9e1' },
  tabsContent: { paddingHorizontal: 15, paddingBottom: 8 },
  tab: { marginRight: 7, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9, backgroundColor: '#e8eee8' },
  tabActive: { marginRight: 7, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9, backgroundColor: '#173c2a' },
  tabText: { color: '#52705d', fontSize: 12, fontWeight: '700' },
  tabTextActive: { color: '#fff', fontSize: 12, fontWeight: '700' },
  content: { padding: 20, paddingBottom: 50 },
  pageTitle: { color: '#173c2a', fontSize: 29, fontWeight: '800' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 20 },
  metric: { width: '48%', minHeight: 92, justifyContent: 'space-between', marginBottom: 12, borderRadius: 14, padding: 14, backgroundColor: '#fff' },
  metricLabel: { color: '#789080', fontSize: 12 },
  metricValue: { marginTop: 14, color: '#173c2a', fontSize: 19, fontWeight: '800' },
  sectionTitle: { marginTop: 12, color: '#244633', fontSize: 16, fontWeight: '800' },
  card: { marginTop: 12, borderRadius: 14, padding: 16, backgroundColor: '#fff' },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eef2ee' },
  lineLabel: { color: '#45624f' },
  lineValue: { color: '#173c2a', fontWeight: '800' },
  recordTitle: { color: '#173c2a', fontSize: 15, fontWeight: '800' }
});

export default App;
