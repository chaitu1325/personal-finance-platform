import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetsDirectory = path.join(webRoot, 'dist', 'assets');

const entries = await readdir(assetsDirectory, { withFileTypes: true });
const javascriptFiles = entries
  .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
  .map((entry) => path.join(assetsDirectory, entry.name));

if (javascriptFiles.length === 0) {
  throw new Error('No JavaScript bundles were generated in dist/assets.');
}

const filesUsingUnboundClassicRuntime = [];
for (const file of javascriptFiles) {
  const content = await readFile(file, 'utf8');
  if (/\bReact\.createElement\s*\(/.test(content)) {
    filesUsingUnboundClassicRuntime.push(path.basename(file));
  }
}

if (filesUsingUnboundClassicRuntime.length > 0) {
  throw new Error(
    `Production bundle contains unresolved classic JSX runtime references: ${filesUsingUnboundClassicRuntime.join(', ')}`
  );
}

console.log(`Verified ${javascriptFiles.length} production JavaScript bundle(s): React JSX runtime is configured.`);
