const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { buildEnvironment } = require('./native-config.cjs');

const [platform, directory] = process.argv.slice(2);
if (!['android', 'ios-simulator'].includes(platform) || !directory) throw new Error('Provide platform and artifact directory');
const build = buildEnvironment(process.env);
const files = fs.readdirSync(directory).filter(name => /\.(apk|aab|tar\.gz)$/.test(name)).sort();
const expected = platform === 'android' ? ['.apk', '.aab'] : ['.tar.gz'];
if (expected.some(extension => !files.some(name => name.endsWith(extension)))) throw new Error('Missing native build artifact');
const artifacts = files.map(name => {
  const file = path.join(directory, name);
  const bytes = fs.readFileSync(file);
  if (bytes.length === 0) throw new Error('Empty native build artifact: ' + name);
  return { name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
});
const manifest = {
  platform, commit: process.env.GITHUB_SHA || 'local', version: require('../app.json').expo.version,
  ...build, builtAt: new Date().toISOString(),
  distribution: platform === 'ios-simulator' ? 'Simulator only; not installable on iPhone' : build.signing === 'test' ? 'Test key; not for store submission' : 'Signed with your release key',
  architectures: platform === 'android' ? 'armeabi-v7a,arm64-v8a,x86,x86_64' : 'arm64,x86_64',
  artifacts
};
fs.writeFileSync(path.join(directory, 'build-info.json'), JSON.stringify(manifest, null, 2) + '\n');
fs.writeFileSync(path.join(directory, 'SHA256SUMS'), artifacts.map(a => a.sha256 + '  ' + a.name).join('\n') + '\n');
console.log(JSON.stringify(manifest, null, 2));
