function buildEnvironment(env) {
  const raw = env.EXPO_PUBLIC_API_BASE_URL;
  if (!raw || raw.trim() !== raw) throw new Error('Set EXPO_PUBLIC_API_BASE_URL to the HTTPS API URL before building');
  let url;
  try { url = new URL(raw); } catch { throw new Error('EXPO_PUBLIC_API_BASE_URL must be an absolute HTTPS URL'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('Use an HTTPS API URL without credentials, query parameters or a fragment');
  }
  if (!url.pathname.replace(/\/$/, '').endsWith('/api/v1')) throw new Error('EXPO_PUBLIC_API_BASE_URL must end with /api/v1');
  const smoke = env.PF_CI_SMOKE_BUILD === '1';
  const host = url.hostname.toLowerCase();
  if ((host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || /\.(invalid|test|localhost)$/.test(host) || /^example\.(com|org|net)$/.test(host)) && !smoke) {
    throw new Error('Replace the placeholder API URL with your reachable HTTPS backend');
  }
  const number = env.PF_BUILD_NUMBER || '1';
  if (!/^[1-9][0-9]*$/.test(number) || Number(number) > 2100000000) throw new Error('PF_BUILD_NUMBER must be an integer from 1 to 2100000000');
  const signing = env.PF_ANDROID_SIGNING || 'test';
  if (!['test', 'release'].includes(signing)) throw new Error('PF_ANDROID_SIGNING must be test or release');
  if (smoke && signing === 'release') throw new Error('Release signing cannot be used with a placeholder/smoke API build');
  return { apiUrl: raw.replace(/\/$/, ''), buildNumber: Number(number), signing, smoke };
}

function nativeConfig(config, env) {
  if (env.PF_NATIVE_BUILD !== '1') return config;
  const build = buildEnvironment(env);
  return {
    ...config,
    android: { ...config.android, versionCode: build.buildNumber },
    ios: { ...config.ios, buildNumber: String(build.buildNumber) }
  };
}

module.exports = { buildEnvironment, nativeConfig };
