import { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8080';

export default function App() {
  const [apiStatus, setApiStatus] = useState('Checking API…');

  useEffect(() => {
    fetch(apiBaseUrl + '/api/v1/health')
      .then((response) => response.json())
      .then((payload) => setApiStatus(payload?.data?.status === 'up' ? 'API online' : 'API unavailable'))
      .catch(() => setApiStatus('API unavailable'));
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>PERSONAL FINANCE PLATFORM</Text>
        <Text style={styles.title}>Your finances, in one place.</Text>
        <Text style={styles.copy}>
          Track family money, rentals, investments, assets, and liabilities.
        </Text>
        <Text style={styles.status}>{apiStatus}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f7fb' },
  hero: { margin: 20, padding: 28, borderRadius: 22, backgroundColor: '#17365D' },
  eyebrow: { color: '#a8c8e8', letterSpacing: 1.5, fontSize: 11, fontWeight: '700' },
  title: { color: '#fff', fontSize: 34, fontWeight: '800', marginTop: 18 },
  copy: { color: '#dcecff', fontSize: 16, lineHeight: 24, marginTop: 14 },
  status: { color: '#c9f7dc', marginTop: 24, fontWeight: '700' },
});
