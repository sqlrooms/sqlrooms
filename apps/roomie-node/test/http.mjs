import {request} from 'node:http';

// Unlike fetch, this preserves explicit Host headers for rebinding tests.
export function http(url, {method = 'POST', headers = {}, body} = {}) {
  return new Promise((resolve, reject) => {
    const req = request(url, {method, headers}, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () =>
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data ? JSON.parse(data) : undefined,
        }),
      );
    });
    req.on('error', reject);
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}
