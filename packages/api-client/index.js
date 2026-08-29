function createApiClient(options) {
  options = options || {};
  var baseUrl = (options.baseUrl || 'http://localhost:8080/api/v1').replace(/\/$/, '');
  var getToken = options.getToken || function () { return null; };

  async function request(path, requestOptions) {
    requestOptions = requestOptions || {};
    var headers = Object.assign({ Accept: 'application/json' }, requestOptions.headers || {});
    var token = getToken();
    if (token) headers.Authorization = 'Bearer ' + token;
    var init = Object.assign({}, requestOptions, { headers: headers });
    if (init.body && typeof init.body !== 'string') {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(init.body);
    }
    var response = await fetch(baseUrl + path, init);
    var payload = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      var message = payload && payload.error && payload.error.message
        ? payload.error.message
        : 'Request failed with status ' + response.status;
      var error = new Error(message);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload.data === undefined ? payload : payload.data;
  }

  return {
    request: request,
    get: function (path) { return request(path); },
    post: function (path, body) { return request(path, { method: 'POST', body: body }); },
    put: function (path, body) { return request(path, { method: 'PUT', body: body }); },
    patch: function (path, body) { return request(path, { method: 'PATCH', body: body }); },
    del: function (path, body) { return request(path, { method: 'DELETE', body: body }); }
  };
}

if (typeof module !== 'undefined') {
  module.exports = { createApiClient: createApiClient };
}
