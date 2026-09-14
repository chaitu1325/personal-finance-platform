const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const FIELDS = 'id,name,size,md5Checksum,parents';
const CHUNK_SIZE = 8 * 1024 * 1024;
class UploadError extends Error {}

function settings(env) {
  const credentials = {};
  for (const [key, variable] of Object.entries({ client_id: 'GOOGLE_DRIVE_CLIENT_ID', client_secret: 'GOOGLE_DRIVE_CLIENT_SECRET', refresh_token: 'GOOGLE_DRIVE_REFRESH_TOKEN' })) {
    if (!env[variable]?.trim()) throw new UploadError('Missing GitHub Actions secret: ' + variable);
    credentials[key] = env[variable].trim();
  }
  const folder = env.GOOGLE_DRIVE_FOLDER_ID || '1pYKQJpriFnh1IQc2t9eMvslbQhD_1pVX';
  if (!/^[A-Za-z0-9_-]{10,}$/.test(folder)) throw new UploadError('GOOGLE_DRIVE_FOLDER_ID must contain a Drive folder ID, not a URL.');
  if (!/^\d+$/.test(env.GITHUB_RUN_ID || '') || !/^\d+$/.test(env.GITHUB_RUN_ATTEMPT || '')) {
    throw new UploadError('GITHUB_RUN_ID and GITHUB_RUN_ATTEMPT are required for versioned upload names.');
  }
  return { credentials, folder, version: env.GITHUB_RUN_ID + '-' + env.GITHUB_RUN_ATTEMPT };
}

async function artifacts(directory) {
  let manifest;
  try { manifest = JSON.parse(await fs.promises.readFile(path.join(directory, 'build-info.json'), 'utf8')); }
  catch { throw new UploadError('Missing or invalid Android build-info.json. Download the complete native build artifact.'); }
  if (manifest.platform !== 'android' || manifest.smoke !== false || !['test', 'release'].includes(manifest.signing)) {
    throw new UploadError('Drive uploads require an Android build configured with a real API URL.');
  }
  const files = [];
  for (const extension of ['apk', 'aab']) {
    const name = 'personal-finance.' + extension;
    const file = path.join(directory, name);
    let stat;
    try { stat = await fs.promises.lstat(file); } catch { throw new UploadError('Missing native package: ' + name); }
    if (!stat.isFile() || stat.size === 0) throw new UploadError('Empty or invalid native package: ' + name);
    const sha256 = createHash('sha256');
    const md5 = createHash('md5');
    for await (const chunk of fs.createReadStream(file)) { sha256.update(chunk); md5.update(chunk); }
    const expected = manifest.artifacts?.find(a => a.name === name);
    if (expected?.bytes !== stat.size || expected?.sha256 !== sha256.digest('hex')) {
      throw new UploadError('Package does not match build-info.json: ' + name);
    }
    files.push({ file, extension, size: stat.size, md5: md5.digest('hex'), signing: manifest.signing });
  }
  return files;
}

async function apiError(response) {
  let body;
  try { body = await response.json(); } catch { body = {}; }
  const reason = body.error?.errors?.[0]?.reason || body.error;
  const messages = {
    invalid_grant: 'Google OAuth refresh token is expired or revoked; authorize again and update GOOGLE_DRIVE_REFRESH_TOKEN.',
    invalid_client: 'Check GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_CLIENT_SECRET.',
    storageQuotaExceeded: 'The Google account has insufficient Drive storage. Use user OAuth credentials with available storage.',
    insufficientFilePermissions: 'The OAuth user needs permission to add files to the destination folder.',
    insufficientPermissions: 'The OAuth grant lacks permission to access this Drive folder.',
    accessNotConfigured: 'Enable Google Drive API in the OAuth client project.',
    notFound: 'Drive folder or upload session was not found; check folder access and retry the upload job.',
    rateLimitExceeded: 'Google Drive rate limit reached; retry the upload job later.',
    userRateLimitExceeded: 'Google Drive user rate limit reached; retry the upload job later.'
  };
  // Never print remote response bodies: they may contain tokens or resumable session URLs.
  return new UploadError(messages[reason] || 'Google Drive request failed (HTTP ' + response.status + '). Check OAuth credentials, Drive API access, and folder permissions.');
}

class Drive {
  constructor(config, { fetchImpl = fetch, sleep = delay, mask = () => {} } = {}) {
    this.config = config;
    this.fetch = fetchImpl;
    this.sleep = sleep;
    this.mask = mask;
  }

  async request(url, options = {}) {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !['www.googleapis.com', 'oauth2.googleapis.com'].includes(parsed.hostname) || parsed.username || parsed.password || parsed.port) {
      throw new UploadError('Google returned an unexpected upload endpoint.');
    }
    try {
      return await this.fetch(url, {
        ...options, headers: { ...(this.token ? { Authorization: 'Bearer ' + this.token } : {}), ...options.headers },
        redirect: 'manual', signal: AbortSignal.timeout(120000)
      });
    } catch { throw new UploadError('Google Drive request timed out or lost its connection; retry the upload job.'); }
  }

  async connect() {
    const response = await this.request('https://oauth2.googleapis.com/token', {
      method: 'POST', body: new URLSearchParams({ ...this.config.credentials, grant_type: 'refresh_token' })
    });
    if (!response.ok) throw await apiError(response);
    const data = await response.json();
    if (typeof data.access_token !== 'string' || !data.access_token || /[\r\n]/.test(data.access_token)) throw new UploadError('Google did not return a valid OAuth access token.');
    this.token = data.access_token;
    this.mask(this.token);
    const folderResponse = await this.request(API + '/files/' + this.config.folder + '?supportsAllDrives=true&fields=id,mimeType,trashed,capabilities(canAddChildren)');
    if (!folderResponse.ok) throw await apiError(folderResponse);
    const folder = await folderResponse.json();
    if (folder.mimeType !== 'application/vnd.google-apps.folder' || folder.trashed || !folder.capabilities?.canAddChildren) {
      throw new UploadError('The destination must be an existing Drive folder the OAuth user can add files to.');
    }
  }

  async verify(result, file, name) {
    if (!/^[A-Za-z0-9_-]+$/.test(result.id || '')) throw new UploadError('Drive did not return a file ID.');
    const response = await this.request(API + '/files/' + result.id + '?supportsAllDrives=true&fields=' + FIELDS);
    if (!response.ok) throw await apiError(response);
    const remote = await response.json();
    if (remote.name !== name || Number(remote.size) !== file.size || remote.md5Checksum !== file.md5 || !remote.parents?.includes(this.config.folder)) {
      throw new UploadError('Uploaded package failed Drive filename, size, checksum, or destination verification.');
    }
    return { name, url: 'https://drive.google.com/file/d/' + result.id + '/view' };
  }

  async upload(file) {
    const name = 'personal-finance-' + file.signing + '-' + this.config.version + '.' + file.extension;
    const mimeType = file.extension === 'apk' ? 'application/vnd.android.package-archive' : 'application/octet-stream';
    const start = await this.request(UPLOAD + '?uploadType=resumable&supportsAllDrives=true&fields=id', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Upload-Content-Type': mimeType, 'X-Upload-Content-Length': String(file.size) },
      body: JSON.stringify({ name, parents: [this.config.folder], mimeType })
    });
    if (!start.ok) throw await apiError(start);
    const session = start.headers.get('location');
    if (!session) throw new UploadError('Google did not return a resumable upload session.');
    const blob = await fs.openAsBlob(file.file);
    let offset = 0;
    let stalled = 0;
    let queryStatus = false;
    while (stalled < 5) {
      const end = Math.min(offset + CHUNK_SIZE, file.size);
      let response;
      try {
        response = await this.request(session, {
          method: 'PUT', headers: { 'Content-Type': mimeType, 'Content-Length': String(queryStatus ? 0 : end - offset), 'Content-Range': queryStatus ? 'bytes */' + file.size : `bytes ${offset}-${end - 1}/${file.size}` },
          body: queryStatus ? Buffer.alloc(0) : blob.slice(offset, end)
        });
      } catch (error) {
        if (!error.message.includes('timed out or lost')) throw error;
        queryStatus = true;
        await this.sleep(1000 * 2 ** stalled++);
        continue;
      }
      if (response.status === 200 || response.status === 201) return this.verify(await response.json(), file, name);
      if (response.status === 429 || response.status >= 500) {
        queryStatus = true;
        await this.sleep(1000 * 2 ** stalled++);
        continue;
      }
      if (response.status !== 308) throw await apiError(response);
      const range = response.headers.get('range');
      const match = range?.match(/^bytes=0-(\d+)$/);
      const next = range === null ? 0 : match ? Number(match[1]) + 1 : NaN;
      if (!Number.isSafeInteger(next) || next < offset || next > end) throw new UploadError('Google returned an invalid resumable upload range.');
      if (next === offset) await this.sleep(1000 * 2 ** stalled++);
      else stalled = 0;
      offset = next;
      queryStatus = offset === file.size;
    }
    throw new UploadError('Drive upload made no progress after five retries. Retry the upload job; GitHub artifacts remain available.');
  }
}

async function main(env = process.env, directory = process.argv[2]) {
  const config = settings(env);
  if (!directory) throw new UploadError('Provide the Android artifact directory.');
  // Validate both packages before sending either file to Google.
  const files = await artifacts(directory);
  const drive = new Drive(config, { mask: token => console.log('::add-mask::' + token) });
  await drive.connect();
  for (const file of files) {
    const result = await drive.upload(file);
    console.log('Uploaded and verified ' + result.name + ': ' + result.url);
    if (env.GITHUB_STEP_SUMMARY) await fs.promises.appendFile(env.GITHUB_STEP_SUMMARY, '- [' + result.name + '](' + result.url + ')\n');
  }
}

if (require.main === module) main().catch(error => {
  console.error(error instanceof UploadError ? error.message : 'Drive upload failed unexpectedly. GitHub build artifacts remain available; retry the upload job.');
  process.exitCode = 1;
});
module.exports = { settings, artifacts, Drive, UploadError, CHUNK_SIZE, apiError };
