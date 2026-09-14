const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { settings, artifacts, Drive, CHUNK_SIZE, apiError } = require('./upload-drive.cjs');
const { workflowOptions } = require('./check-workflow.cjs');

const env = {
  GOOGLE_DRIVE_CLIENT_ID: 'test-client', GOOGLE_DRIVE_CLIENT_SECRET: 'test-secret', GOOGLE_DRIVE_REFRESH_TOKEN: 'test-refresh',
  GITHUB_RUN_ID: '12345', GITHUB_RUN_ATTEMPT: '2'
};
const response = (body, status = 200, headers = {}) => new Response(body === null ? null : JSON.stringify(body), { status, headers });

async function fixture(t, size = 512) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'finance-drive-'));
  t.after(() => fs.rmSync(directory, { force: true, recursive: true }));
  const entries = [];
  for (const extension of ['apk', 'aab']) {
    const name = 'personal-finance.' + extension;
    const data = Buffer.alloc(size, extension === 'apk' ? 42 : 84);
    fs.writeFileSync(path.join(directory, name), data);
    entries.push({ name, bytes: size, sha256: createHash('sha256').update(data).digest('hex') });
  }
  fs.writeFileSync(path.join(directory, 'build-info.json'), JSON.stringify({ platform: 'android', smoke: false, signing: 'test', artifacts: entries }));
  return { directory, files: await artifacts(directory) };
}

function fakeDrive(handler) {
  const config = settings(env);
  const calls = [];
  const masked = [];
  const drive = new Drive(config, {
    sleep: async () => {}, mask: value => masked.push(value),
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      assert.equal(options.redirect, 'manual');
      if (url === 'https://oauth2.googleapis.com/token') {
        assert.equal(options.body.get('grant_type'), 'refresh_token');
        assert.equal(options.body.get('refresh_token'), env.GOOGLE_DRIVE_REFRESH_TOKEN);
        return response({ access_token: 'private-access-token' });
      }
      assert.equal(options.headers.Authorization, 'Bearer private-access-token');
      if (url.includes('/files/' + config.folder)) return response({ mimeType: 'application/vnd.google-apps.folder', capabilities: { canAddChildren: true } });
      return handler(url, options, calls);
    }
  });
  return { drive, calls, config, masked };
}

test('build selectors support Android, iOS, and both; reject an empty selection', () => {
  const defaults = { PF_BUILD_ANDROID: 'true', PF_BUILD_IOS: 'true', PF_UPLOAD_TO_DRIVE: 'true', BUILD_EVENT: 'workflow_dispatch', BUILD_REF: 'refs/heads/main' };
  assert.deepEqual(workflowOptions(defaults), { android: true, ios: true, upload: true });
  assert.deepEqual(workflowOptions({ ...defaults, PF_BUILD_IOS: 'false' }), { android: true, ios: false, upload: true });
  assert.deepEqual(workflowOptions({ ...defaults, PF_BUILD_ANDROID: 'false' }), { android: false, ios: true, upload: false });
  assert.throws(() => workflowOptions({ ...defaults, PF_BUILD_ANDROID: 'false', PF_BUILD_IOS: 'false' }), /at least one/);
  assert.throws(() => workflowOptions({ ...defaults, PF_BUILD_IOS: 'no' }), /true or false/);
  for (const override of [{ BUILD_EVENT: 'pull_request' }, { BUILD_REF: 'refs/heads/feature/example' }]) {
    assert.throws(() => workflowOptions({ ...defaults, ...override }), /manual build from reviewed main/);
    assert.equal(workflowOptions({ ...defaults, ...override, PF_UPLOAD_TO_DRIVE: 'false' }).upload, false);
  }
});

test('upload configuration requires each OAuth secret and a folder ID', () => {
  for (const name of ['GOOGLE_DRIVE_CLIENT_ID', 'GOOGLE_DRIVE_CLIENT_SECRET', 'GOOGLE_DRIVE_REFRESH_TOKEN']) {
    assert.throws(() => settings({ ...env, [name]: '' }), new RegExp(name));
  }
  assert.equal(settings(env).folder, '1pYKQJpriFnh1IQc2t9eMvslbQhD_1pVX');
  assert.equal(settings(env).version, '12345-2');
  assert.throws(() => settings({ ...env, GOOGLE_DRIVE_FOLDER_ID: 'https://drive.google.com/folders/private' }), /folder ID/);
  assert.throws(() => settings({ ...env, GITHUB_RUN_ID: '' }), /GITHUB_RUN_ID/);
});

test('both APK and AAB must match the manifest before either upload starts', async t => {
  const { directory, files } = await fixture(t);
  assert.deepEqual(files.map(f => f.extension), ['apk', 'aab']);
  fs.appendFileSync(files[1].file, 'corruption');
  await assert.rejects(artifacts(directory), /does not match/);
  fs.unlinkSync(files[1].file);
  await assert.rejects(artifacts(directory), /Missing native package/);
});

test('smoke builds cannot be uploaded as configured packages', async t => {
  const { directory } = await fixture(t);
  const manifest = path.join(directory, 'build-info.json');
  const data = JSON.parse(fs.readFileSync(manifest));
  data.smoke = true;
  fs.writeFileSync(manifest, JSON.stringify(data));
  await assert.rejects(artifacts(directory), /real API URL/);
});

test('uploads both file types to the requested folder and verifies remote content', async t => {
  const { files } = await fixture(t);
  let index = 0;
  let metadata;
  const fake = fakeDrive(async (url, options) => {
    const file = files[index];
    if (options.method === 'POST') {
      metadata = JSON.parse(options.body);
      assert.deepEqual(metadata.parents, [fake.config.folder]);
      assert.equal(metadata.name, `personal-finance-test-12345-2.${file.extension}`);
      assert.equal(metadata.permissions, undefined);
      return response(null, 200, { location: 'https://www.googleapis.com/upload/drive/v3/files?upload_id=private-session' });
    }
    if (options.method === 'PUT') {
      assert.equal(options.headers['Content-Range'], `bytes 0-${file.size - 1}/${file.size}`);
      assert.equal((await options.body.arrayBuffer()).byteLength, file.size);
      return response({ id: 'uploaded-file-' + index });
    }
    index++;
    return response({ id: 'uploaded-file-' + (index - 1), name: metadata.name, size: String(file.size), md5Checksum: file.md5, parents: metadata.parents });
  });
  await fake.drive.connect();
  for (const file of files) assert.match((await fake.drive.upload(file)).url, /^https:\/\/drive.google.com\/file\/d\//);
  assert.equal(index, 2);
  assert.deepEqual(fake.masked, ['private-access-token']);
});

test('large uploads resume at the server offset after a lost chunk response', async t => {
  const { files: [file] } = await fixture(t, CHUNK_SIZE + 1024);
  const ranges = [];
  const fake = fakeDrive(async (url, options) => {
    if (options.method === 'POST') return response(null, 200, { location: 'https://www.googleapis.com/upload/drive/v3/files?upload_id=test' });
    if (options.method === 'PUT') {
      const range = options.headers['Content-Range'];
      ranges.push(range);
      if (ranges.length === 1) throw new Error('Network dropped; private-session must not leak');
      if (ranges.length === 2) return response(null, 308, { Range: 'bytes=0-262143' });
      return response({ id: 'resumed-file' });
    }
    return response({ name: 'personal-finance-test-12345-2.apk', size: String(file.size), md5Checksum: file.md5, parents: [fake.config.folder] });
  });
  await fake.drive.connect();
  await fake.drive.upload(file);
  assert.deepEqual(ranges, [`bytes 0-${CHUNK_SIZE - 1}/${file.size}`, `bytes */${file.size}`, `bytes 262144-${file.size - 1}/${file.size}`]);
});

test('a lost final response is confirmed with a status query without re-uploading', async t => {
  const { files: [file] } = await fixture(t);
  let puts = 0;
  const fake = fakeDrive(async (url, options) => {
    if (options.method === 'POST') return response(null, 200, { location: 'https://www.googleapis.com/upload/drive/v3/files?upload_id=test' });
    if (options.method === 'PUT') {
      if (++puts === 1) return response(null, 503);
      assert.equal(options.headers['Content-Range'], 'bytes */' + file.size);
      return response({ id: 'completed-file' });
    }
    return response({ name: 'personal-finance-test-12345-2.apk', size: String(file.size), md5Checksum: file.md5, parents: [fake.config.folder] });
  });
  await fake.drive.connect();
  await fake.drive.upload(file);
  assert.equal(puts, 2);
});

test('upload stops after bounded retries when Drive makes no progress', async t => {
  const { files: [file] } = await fixture(t);
  let puts = 0;
  const fake = fakeDrive(async (url, options) => {
    if (options.method === 'POST') return response(null, 200, { location: 'https://www.googleapis.com/upload/drive/v3/files?upload_id=test' });
    puts++;
    return response(null, 308);
  });
  await fake.drive.connect();
  await assert.rejects(fake.drive.upload(file), /five retries/);
  assert.equal(puts, 5);
});

test('unexpected session hosts cannot receive OAuth tokens or package data', async t => {
  const { files: [file] } = await fixture(t);
  const fake = fakeDrive(async () => response(null, 200, { location: 'https://untrusted.example/upload' }));
  await fake.drive.connect();
  await assert.rejects(fake.drive.upload(file), /unexpected upload endpoint/);
  assert.equal(fake.calls.length, 3);
});

test('permission and OAuth failures are actionable without disclosing remote bodies', async () => {
  const error = await apiError(response({ error: 'invalid_grant', error_description: 'private-refresh-token' }, 400));
  assert.match(error.message, /GOOGLE_DRIVE_REFRESH_TOKEN/);
  assert.doesNotMatch(error.message, /private-refresh-token/);
  const unknown = await apiError(response({ error: { message: 'private-session-url' } }, 403));
  assert.match(unknown.message, /HTTP 403/);
  assert.doesNotMatch(unknown.message, /private-session-url/);
  const drive = new Drive(settings(env), { fetchImpl: async (url) => url.endsWith('/token') ? response({ access_token: 'private-token' }) : response({ mimeType: 'application/vnd.google-apps.folder', capabilities: { canAddChildren: false } }) });
  await assert.rejects(drive.connect(), /can add files to/);
});

test('remote checksum or folder mismatch cannot report a successful upload', async t => {
  const { files: [file] } = await fixture(t);
  const fake = fakeDrive(async (url, options) => {
    if (options.method === 'POST') return response(null, 200, { location: 'https://www.googleapis.com/upload/drive/v3/files?upload_id=test' });
    if (options.method === 'PUT') return response({ id: 'bad-upload' });
    return response({ name: 'personal-finance-test-12345-2.apk', size: String(file.size), md5Checksum: 'bad-checksum', parents: ['other-folder'] });
  });
  await fake.drive.connect();
  await assert.rejects(fake.drive.upload(file), /checksum, or destination/);
});
