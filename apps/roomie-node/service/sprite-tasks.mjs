import {request} from 'node:http';

/** Expiring Sprite holds, using the documented local Tasks API (no cloud token). */
export function createSpriteTasks(
  socketPath = '/.sprite/api.sock',
  name = 'roomie-work',
) {
  async function call(method) {
    await new Promise((resolve, reject) => {
      const req = request(
        {
          socketPath,
          host: 'sprite',
          path: '/v1/tasks/' + encodeURIComponent(name),
          method,
          headers: {'Content-Type': 'application/json'},
        },
        (response) => {
          response.resume();
          response.on('error', reject);
          response.on('end', () => {
            if (
              (response.statusCode >= 200 && response.statusCode < 300) ||
              (method === 'DELETE' && response.statusCode === 404)
            )
              resolve();
            else
              reject(
                Error(`Sprite task ${method} failed (${response.statusCode}).`),
              );
          });
        },
      );
      const timer = setTimeout(
        () => req.destroy(Error('Sprite task request timed out.')),
        3000,
      );
      req.on('close', () => clearTimeout(timer));
      req.on('error', reject);
      req.end(method === 'PUT' ? JSON.stringify({expire: 30}) : undefined);
    });
  }
  return {hold: () => call('PUT'), release: () => call('DELETE')};
}
