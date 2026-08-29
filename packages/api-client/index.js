export function createApiClient(baseUrl, getToken = () => null) {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');

  async function request(path, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set('Accept', 'application/json');
    if (options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const token = getToken();
    if (token) {
      headers.set('Authorization', \`Bearer \${token}\`);
    }

    const response = await fetch(\`\${normalizedBaseUrl}\${path}\`, {
      ...options,
      headers,
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload.success === false) {
      const error = new Error(payload?.error?.message || 'API request failed');
      error.code = payload?.error?.code || 'API_ERROR';
      error.status = response.status;
      error.details = payload?.error?.details || {};
      throw error;
    }

    return payload.data;
  }

  return {
    get: (path, options = {}) => request(path, { ...options, method: 'GET' }),
    post: (path, body, options = {}) => request(path, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body),
    }),
    request,
  };
}
