const fs = require('node:fs');
const path = require('node:path');
const { buildEnvironment } = require('./native-config.cjs');

const marker = '// Personal Finance native signing configuration';
function signingConfig(source) {
  if (!source.includes('com.android.application') || !source.includes('signingConfigs')) throw new Error('Unrecognised Android app Gradle template');
  const original = source.split(marker)[0].trimEnd();
  return original + '\n\n' + marker + `
// Secrets are read at build time and are never written into this file.
if (System.getenv("PF_ANDROID_SIGNING") == "release") {
    android.signingConfigs {
        pfRelease {
            storeFile new File(System.getenv("PF_ANDROID_KEYSTORE_FILE"))
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ANDROID_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_KEY_PASSWORD")
        }
    }
    android.buildTypes.release.signingConfig = android.signingConfigs.pfRelease
} else {
    // Standalone Release APK with a public test key; never upload this to a store.
    android.buildTypes.release.signingConfig = android.signingConfigs.debug
}
android.buildTypes.release.debuggable = false
`;
}

function requireSigning(env) {
  if (env.PF_ANDROID_SIGNING !== 'release') return;
  for (const key of ['PF_ANDROID_KEYSTORE_FILE', 'ANDROID_KEYSTORE_PASSWORD', 'ANDROID_KEY_ALIAS', 'ANDROID_KEY_PASSWORD']) {
    if (!env[key]) throw new Error('Missing release signing setting: ' + key);
  }
  if (!fs.statSync(env.PF_ANDROID_KEYSTORE_FILE).isFile()) throw new Error('Release keystore must be a file');
}

if (require.main === module) {
  buildEnvironment(process.env);
  requireSigning(process.env);
  const file = path.join(__dirname, '../android/app/build.gradle');
  fs.writeFileSync(file, signingConfig(fs.readFileSync(file, 'utf8')));
}
module.exports = { signingConfig, requireSigning };
