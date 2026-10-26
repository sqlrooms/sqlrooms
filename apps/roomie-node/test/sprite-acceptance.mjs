// Upload to the disposable Sprite and run with Node. Never prints credentials.
// Assumes scripts/deploy-roomie-node-to-sprite.sh's installation paths.
import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {request} from 'node:http';
import {setTimeout as delay} from 'node:timers/promises';
const root = '/home/sprite/roomie-service/node_modules/@sqlrooms/roomie-node';
const {default: WebSocket} = await import(
  root + '/node_modules/ws/wrapper.mjs'
).catch(
  () => import('/home/sprite/roomie-service/node_modules/ws/wrapper.mjs'),
);
const statePath = '/home/sprite/roomie-acceptance.json';
async function records() {
  return (await readFile('/.sprite/logs/services/roomie.log', 'utf8'))
    .split('\n')
    .flatMap((line) => {
      try {
        return [JSON.parse(line.slice(line.indexOf('{')))];
      } catch {
        return [];
      }
    });
}
async function control() {
  const log = await records();
  const entry = log.findLast((entry) => entry.credentialPath);
  return {
    ...entry,
    token: JSON.parse(await readFile(entry.credentialPath, 'utf8')).token,
    pid: log.findLast((entry) => entry.event === 'host-start').pid,
  };
}
function tasks() {
  return new Promise((resolve, reject) => {
    const req = request(
      {socketPath: '/.sprite/api.sock', host: 'sprite', path: '/v1/tasks'},
      (res) => {
        let body = '';
        res.on('data', (c) => {
          body += c;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(body).tasks);
          } catch (e) {
            reject(e);
          }
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}
async function wait(fn) {
  for (let i = 0; i < 400; i++) {
    const result = await fn();
    if (result) return result;
    await delay(100);
  }
  throw Error('Acceptance timed out');
}
const headers = (host) => ({
  Authorization: `Bearer ${host.token}`,
  'Content-Type': 'application/json',
});
async function command(host, body) {
  const response = await fetch(host.url + '/api/commands', {
    method: 'POST',
    headers: headers(host),
    body: JSON.stringify(body),
  });
  assert.equal(response.status, 200);
  const value = await response.json();
  assert.equal(value.ok, true);
  return value;
}
const create = {
  commandId: 'block-document.create',
  input: {title: 'Sprite lifecycle acceptance'},
  commit: {operationId: 'sprite-document'},
};
async function check(host) {
  const saved = JSON.parse(await readFile(statePath, 'utf8'));
  assert.deepEqual(await command(host, create), saved.created);
  const snapshot = await fetch(host.url + '/api/content', {
    headers: headers(host),
  }).then((r) => r.json());
  const id = saved.created.data.receipt.artifactId;
  assert.equal(snapshot.revisions[id], 2);
  assert.equal(
    snapshot.content.artifacts.artifactsById[id].title,
    create.input.title,
  );
  const ws = new WebSocket(host.url.replace('http:', 'ws:') + '/ws');
  const result = await new Promise((resolve, reject) => {
    ws.on('error', reject);
    ws.on('open', () =>
      ws.send(JSON.stringify({type: 'auth', token: host.token})),
    );
    ws.on('message', (bytes) => {
      const frame = JSON.parse(bytes.toString());
      if (frame.type === 'authAck')
        ws.send(
          JSON.stringify({
            type: 'json',
            queryId: 'recovered',
            sql: 'SELECT month, amount FROM lifecycle_sales ORDER BY month',
          }),
        );
      else if (frame.type === 'json') resolve(frame.data);
      else reject(Error(frame.error));
    });
  });
  ws.close();
  await new Promise((resolve) => ws.once('close', resolve));
  assert.deepEqual(result, [
    {month: '2026-01', amount: 300},
    {month: '2026-02', amount: 450},
  ]);
  await wait(
    async () => !(await tasks()).some((t) => t.name === 'roomie-work'),
  );
  console.log(
    JSON.stringify({
      check: 'recovered-data-document-receipt',
      pid: host.pid,
      artifactId: id,
      rows: result,
      leaseReleased: true,
    }),
  );
}
const action = process.argv[2];
let host = await control();
if (action === 'seed') {
  assert.equal((await fetch(host.url + '/api/content')).status, 401);
  assert.equal((await fetch(host.url)).status, 200);
  const uploaded = await fetch(
    host.url + '/api/upload?format=csv&table=lifecycle_sales',
    {
      method: 'POST',
      headers: {...headers(host), 'x-roomie-operation': 'sprite-upload'},
      body: 'month,amount\n2026-01,300\n2026-02,450\n',
    },
  );
  assert.equal(uploaded.status, 200);
  const created = await command(host, create);
  const artifactId = created.data.receipt.artifactId;
  await command(host, {
    commandId: 'block-document.create-chart-block',
    input: {
      artifactId,
      blockId: 'stable-chart',
      tableName: 'lifecycle_sales',
      config: {chartType: 'histogram', settings: {field: 'amount'}},
    },
    commit: {operationId: 'sprite-chart', artifactId, expectedRevision: 1},
  });
  await writeFile(statePath, JSON.stringify({created}), {mode: 0o600});
  await check(host);
} else if (action === 'check') await check(host);
else if (action === 'ticket') {
  const result = await fetch(host.url + '/api/auth/ticket', {
    method: 'POST',
    headers: headers(host),
  }).then((r) => r.json());
  // Single-use short-lived browser ticket; never print the native owner credential.
  console.log(result.url);
} else if (action === 'stall' || action === 'renew') {
  await wait(
    async () => !(await tasks()).some((t) => t.name === 'roomie-work'),
  );
  const req = request(
    host.url + '/api/upload?format=csv&table=partial',
    {
      method: 'POST',
      headers: {
        ...headers(host),
        'Content-Length': 100,
        'x-roomie-operation': 'partial',
      },
    },
    (res) => res.resume(),
  );
  req.on('error', () => {});
  req.write('a');
  const first = await wait(async () =>
    (await tasks()).find((t) => t.name === 'roomie-work'),
  );
  try {
    if (action === 'stall') {
      process.kill(host.pid, 'SIGSTOP');
      host = await wait(async () => {
        try {
          const next = await control();
          return next.pid !== host.pid &&
            (await records()).some(
              (r) => r.event === 'host-ready' && r.pid === next.pid,
            )
            ? next
            : undefined;
        } catch {
          return undefined;
        }
      });
      assert.ok(
        (await records()).some((r) => r.reason === 'host heartbeat expired'),
      );
      console.log(
        JSON.stringify({check: 'stopped-host-restarted', pid: host.pid}),
      );
    } else {
      await delay(12000);
      const renewed = (await tasks()).find((t) => t.name === 'roomie-work');
      assert.ok(renewed);
      assert.ok(new Date(renewed.expires_at) > new Date(first.expires_at));
      console.log(
        JSON.stringify({check: 'sprite-task-renewed', first, renewed}),
      );
    }
  } finally {
    req.destroy();
  }
  await check(host);
} else throw Error('Use seed, check, stall, renew or ticket');
