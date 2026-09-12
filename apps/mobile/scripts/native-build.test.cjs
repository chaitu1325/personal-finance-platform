const assert = require('node:assert/strict');
const test = require('node:test');
const { buildEnvironment, nativeConfig } = require('./native-config.cjs');
const { signingConfig, requireSigning } = require('./configure-android.cjs');

const env = { EXPO_PUBLIC_API_BASE_URL: 'https://finance.example.org/api/v1', PF_BUILD_NUMBER: '12' };
test('native builds require an explicit usable API URL', () => {
  assert.throws(() => buildEnvironment({}), /EXPO_PUBLIC_API_BASE_URL/);
  for (const url of ['http://finance.example.org/api/v1', 'not-a-url', 'https://user:password@finance.example.org/api/v1', 'https://finance.example.org/api/v1?token=private', 'https://example.invalid/api/v1', 'https://localhost/api/v1', 'https://finance.example.org']) {
    assert.throws(() => buildEnvironment({ ...env, EXPO_PUBLIC_API_BASE_URL: url }));
  }
  assert.equal(buildEnvironment(env).apiUrl, env.EXPO_PUBLIC_API_BASE_URL);
});
test('CI placeholder builds are explicit and cannot be release signed', () => {
  const smoke = { ...env, PF_CI_SMOKE_BUILD: '1', EXPO_PUBLIC_API_BASE_URL: 'https://example.invalid/api/v1' };
  assert.equal(buildEnvironment(smoke).smoke, true);
  assert.throws(() => buildEnvironment({ ...smoke, PF_ANDROID_SIGNING: 'release' }), /Release signing/);
});
test('build numbers are bounded and app identifiers/settings are preserved', () => {
  for (const value of ['0', '-1', 'abc', '1.2', '2100000001']) assert.throws(() => buildEnvironment({ ...env, PF_BUILD_NUMBER: value }), /PF_BUILD_NUMBER/);
  const config = { name: 'Personal Finance', android: { package: 'com.example.finance' }, ios: { bundleIdentifier: 'com.example.finance' } };
  assert.equal(nativeConfig(config, {}), config);
  const native = nativeConfig(config, { ...env, PF_NATIVE_BUILD: '1' });
  assert.equal(native.android.versionCode, 12); assert.equal(native.ios.buildNumber, '12');
  assert.equal(native.android.package, config.android.package); assert.equal(native.ios.bundleIdentifier, config.ios.bundleIdentifier);
});
test('release signing never falls back silently when credentials are incomplete', () => {
  assert.doesNotThrow(() => requireSigning({ PF_ANDROID_SIGNING: 'test' }));
  assert.throws(() => requireSigning({ PF_ANDROID_SIGNING: 'release' }), /PF_ANDROID_KEYSTORE_FILE/);
  assert.throws(() => buildEnvironment({ ...env, PF_ANDROID_SIGNING: 'unknown' }), /PF_ANDROID_SIGNING/);
});
test('Gradle signing configuration is idempotent and reads secrets only at build time', () => {
  const source = 'apply plugin: "com.android.application"\nandroid { signingConfigs { debug {} } }\n';
  const result = signingConfig(source);
  assert.equal(signingConfig(result), result);
  assert.match(result, /System.getenv\("ANDROID_KEYSTORE_PASSWORD"\)/);
  assert.match(result, /release.debuggable = false/);
  assert.throws(() => signingConfig('unrecognised template'), /Unrecognised/);
});
