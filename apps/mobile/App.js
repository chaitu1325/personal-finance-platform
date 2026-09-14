import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';

import { createApi } from '../../packages/finance-core/index.js';
import { Action, MobileAnalysis, MobileWorkspace } from './FinanceWorkspace';
const API_BASE = (process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8080/api/v1').replace(/\/$/, '');
const api = (path, options, token) => createApi(API_BASE, () => token)(path, options);

function Auth({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [displayName, setDisplayName] = useState('');
  var [email, setEmail] = useState('');
  var [password, setPassword] = useState('');
  var [busy, setBusy] = useState(false);
  var [error, setError] = useState('');

  async function submit() {
    setBusy(true);
    setError('');
    try {
      var result = await api('/auth/' + mode, { method: 'POST', body: { email: email, password: password, display_name: displayName } });
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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.authContent}>
      <View style={styles.authCard}>
        <Text style={styles.logo}>PF</Text>
        <Text style={styles.eyebrow}>PERSONAL FINANCE</Text>
        <Text style={styles.title}>Your family money, clearly organised.</Text>
        <Text style={styles.muted}>Sign in to view cash flow, rentals, investments, assets and liabilities.</Text>
        {mode === 'register' && <TextInput accessibilityLabel="Display name" placeholder="Display name" value={displayName} onChangeText={setDisplayName} style={styles.input} />}
        <TextInput accessibilityLabel="Email" autoCapitalize="none" keyboardType="email-address" placeholder="Email" value={email} onChangeText={setEmail} style={styles.input} />
        <TextInput accessibilityLabel="Password" secureTextEntry placeholder="Password" value={password} onChangeText={setPassword} style={styles.input} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={styles.primary} onPress={submit} disabled={busy}><Text style={styles.primaryText}>{busy ? 'Working…' : mode === 'login' ? 'Sign in' : 'Register'}</Text></Pressable>
        <Action disabled={busy} onPress={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>{mode === 'login' ? 'Create a family workspace' : 'Already registered? Sign in'}</Action>
      </View>
      </ScrollView></KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function App() {
  var [session, setSession] = useState(null);
  var [active, setActive] = useState('dashboard');
  var [dashboard, setDashboard] = useState(null);
  var [error, setError] = useState('');
  var [loading, setLoading] = useState(false);
  const [catalog, setCatalog] = useState([]);
  const [catalogError, setCatalogError] = useState('');
  const [catalogRevision, setCatalogRevision] = useState(0);
  const scroll = useRef(null);
  const scrollTop = () => scroll.current?.scrollTo({ y: 0, animated: true });
  const navigate = key => { setActive(key); scrollTop(); };
  const request = useMemo(() => createApi(API_BASE, () => session?.token), [session]);
  const modules = [{ key: 'dashboard', label: 'Dashboard' }, ...catalog, { key: 'analysis', label: 'Expense analysis' }];
  const currentModule = catalog.find(module => module.key === active);
  useEffect(() => {
    if (!session) return;
    let live = true;
    setCatalogError('');
    request('/catalog').then(result => { if (live) setCatalog(result.modules); }).catch(e => { if (live) setCatalogError(e.message); });
    return () => { live = false; };
  }, [request, session, catalogRevision]);

  useEffect(function () {
    if (!session || active !== 'dashboard') return;
    let live = true;
    setLoading(true);
    var path = active === 'dashboard' ? '/dashboard' : '/' + active;
    api(path, {}, session.token).then(function (result) {
      if (live) { setDashboard(result);
      setError(''); }
    }).catch(function (e) { if (live) setError(e.message); }).finally(function () { if (live) setLoading(false); });
    return () => { live = false; };
  }, [active, session]);

  if (!session) return <Auth onLogin={setSession} />;
  var summary = dashboard && dashboard.summary ? dashboard.summary : {};
  var netWorth = dashboard && dashboard.net_worth ? dashboard.net_worth : {};

  return (
    <SafeAreaView style={styles.page}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}><View><Text style={styles.eyebrow}>PERSONAL FINANCE</Text><Text style={styles.headerTitle}>{session.user.display_name}</Text></View><Pressable onPress={function () { setActive('dashboard'); setCatalog([]); setSession(null); }}><Text style={styles.signOut}>Sign out</Text></Pressable></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs} contentContainerStyle={styles.tabsContent}>{modules.map(function (module) { return <Pressable key={module.key} onPress={function () { navigate(module.key); }} style={active === module.key ? styles.tabActive : styles.tab}><Text style={active === module.key ? styles.tabTextActive : styles.tabText}>{module.label}</Text></Pressable>; })}</ScrollView>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {catalogError ? <View><Text style={styles.error}>{catalogError}</Text><Action onPress={() => setCatalogRevision(r => r + 1)}>Retry loading modules</Action></View> : null}
        {active === 'dashboard' && loading ? <ActivityIndicator color="#173c2a" /> : null}
        {active === 'dashboard' && error ? <Text style={styles.error}>{error}</Text> : null}
        {active === 'dashboard' ? <View><Text style={styles.pageTitle}>Overview</Text><Text style={styles.muted}>A compact view of your family workspace.</Text><View style={styles.metrics}><Metric label="Income" value={summary.income} /><Metric label="Expenses" value={summary.expenses} /><Metric label="Net cash flow" value={summary.net_cash_flow} /><Metric label="Net worth" value={netWorth.total} /></View><Text style={styles.sectionTitle}>Net worth mix</Text><View style={styles.card}><Line label="Assets" value={netWorth.assets} /><Line label="Properties" value={netWorth.properties} /><Line label="Investments" value={netWorth.investments} /><Line label="Liabilities" value={netWorth.liabilities} /></View></View> : active === 'analysis' ? <MobileAnalysis api={request} /> : currentModule ? <MobileWorkspace key={currentModule.key} module={currentModule} api={request} onNavigate={navigate} onScrollTop={scrollTop} /> : <Text>Loading module…</Text>}
      </ScrollView></KeyboardAvoidingView>
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
  page: { flex: 1, backgroundColor: '#f3f6f2', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  authPage: { flex: 1, backgroundColor: '#f3f6f2', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  authContent: { flexGrow: 1, justifyContent: 'center', padding: 22, paddingBottom: 50 },
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
  content: { padding: 20, paddingBottom: 70 },
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
