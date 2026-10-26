import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer, request} from 'node:http';
import {spawn} from 'node:child_process';
import {readFile, mkdtemp, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {createSpriteTasks} from '../service/sprite-tasks.mjs';
import {superviseHost} from '../service/watchdog.mjs';
import {socketClient} from './websocket-conformance.mjs';
import {http} from './http.mjs';
import {openWorkspace, startWorkspaceServer} from '../dist/index.mjs';

async function waitFor(fn) {
  for (let i = 0; i < 600; i++) {
    const result = await fn();
    if (result) return result;
    await delay(20);
  }
  throw Error('Timed out');
}
async function fixture(t, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'roomie-service-'));
  const socketPath = join(directory, 'tasks.sock');
  let held = false,
    renewals = 0,
    fail = false;
  const api = createServer((req, res) => {
    assert.equal(req.headers.host, 'sprite');
    assert.equal(req.url, '/v1/tasks/roomie-work');
    req.resume();
    req.on('end', () => {
      if (fail) {
        res.writeHead(503);
        res.end();
        return;
      }
      if (req.method === 'PUT') {
        held = true;
        renewals++;
        res.writeHead(200);
        res.end('{}');
      } else {
        held = false;
        res.writeHead(204);
        res.end();
      }
    });
  });
  await new Promise((r) => api.listen(socketPath, r));
  const controller = new AbortController();
  const reports = [];
  let child,
    output = '',
    errors = '';
  const done = superviseHost({
    tasks: createSpriteTasks(socketPath),
    signal: controller.signal,
    tickMs: 50,
    renewMs: 200,
    heartbeatMs: 2200,
    ...options,
    report: (e) => reports.push(e),
    spawnHost: () => {
      child = spawn(
        process.execPath,
        [
          fileURLToPath(new URL('../bin/roomie-node.mjs', import.meta.url)),
          join(directory, 'workspace'),
        ],
        {
          detached: true,
          stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
          env: {...process.env, ROOMIE_MANAGED: '1'},
        },
      );
      child.stdout.on('data', (c) => {
        output += c;
      });
      child.stderr.on('data', (c) => {
        errors += c;
      });
      return child;
    },
  });
  // Attach rejection immediately so a startup failure is never unhandled.
  const settled = done.then(
    (value) => ({value}),
    (error) => ({error}),
  );
  t.after(async () => {
    controller.abort();
    await settled;
    await new Promise((r) => api.close(r));
    await rm(directory, {recursive: true, force: true});
  });
  await waitFor(() => {
    if (reports.some((r) => r.event === 'host-exit'))
      throw Error(errors || JSON.stringify(reports));
    return reports.some((r) => r.event === 'host-ready');
  });
  const control = JSON.parse(
    output.split('\n').find((line) => line.startsWith('{"url"')),
  );
  const {token} = JSON.parse(await readFile(control.credentialPath, 'utf8'));
  return {
    directory,
    child,
    control,
    token,
    controller,
    reports,
    done: () => settled,
    held: () => held,
    renewals: () => renewals,
    fail: () => {
      fail = true;
    },
  };
}
const headers = (token) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});
function pendingUpload(f) {
  const req = request(
    f.control.url + '/api/upload?format=csv&table=slow',
    {
      method: 'POST',
      headers: {
        ...headers(f.token),
        'Content-Length': 100,
        'x-roomie-operation': 'slow',
      },
    },
    (res) => res.resume(),
  );
  req.on('error', () => {});
  req.write('a');
  return req;
}

test(
  'managed query work renews leases, idle subscriptions do not, and cancellation drains before release',
  {timeout: 60000},
  async (t) => {
    const f = await fixture(t);
    await waitFor(() => !f.held());
    const upload = await fetch(
      f.control.url + '/api/upload?format=csv&table=sales',
      {
        method: 'POST',
        headers: {...headers(f.token), 'x-roomie-operation': 'seed'},
        body:
          'amount\n' +
          Array.from({length: 2000}, (_, i) => String(i)).join('\n'),
      },
    );
    assert.equal(upload.status, 200);
    const ws = await socketClient(f.control.url, f.token);
    t.after(() => ws.ws.terminate());
    await waitFor(() => !f.held());
    ws.send({
      type: 'json',
      queryId: 'slow',
      sql: 'SELECT sum(a.amount * b.amount * c.amount) AS total FROM sales a, sales b, sales c',
    });
    await waitFor(f.held);
    const before = f.renewals();
    await delay(500);
    assert.ok(f.renewals() > before);
    ws.send({type: 'cancel', queryId: 'slow'});
    const result = await ws.next();
    assert.equal(result.type, 'error');
    await waitFor(() => !f.held());
    await delay(300);
    assert.equal(f.held(), false);
    await ws.close();
    f.controller.abort();
    const end = await f.done();
    assert.ok(!end.error);
    assert.equal(f.held(), false);
  },
);

test(
  'external watchdog kills a SIGSTOP host during accepted work; committed content recovers',
  {timeout: 60000},
  async (t) => {
    const f = await fixture(t);
    const body = {
      commandId: 'block-document.create',
      input: {title: 'Survives stopped host'},
      commit: {operationId: 'durable'},
    };
    const created = await fetch(f.control.url + '/api/commands', {
      method: 'POST',
      headers: headers(f.token),
      body: JSON.stringify(body),
    }).then((r) => r.json());
    assert.equal(created.ok, true);
    await waitFor(() => !f.held());
    const upload = pendingUpload(f);
    t.after(() => upload.destroy());
    await waitFor(f.held);
    process.kill(f.child.pid, 'SIGSTOP');
    const end = await f.done();
    assert.ok(!end.error);
    assert.equal(end.value.reason, 'host heartbeat expired');
    assert.equal(f.held(), false);
    const workspace = await openWorkspace({
      directory: join(f.directory, 'workspace'),
    });
    try {
      assert.deepEqual(
        await workspace.mutate({
          commandId: body.commandId,
          input: body.input,
          operationId: 'durable',
          principalId: 'owner',
        }),
        created.data.receipt,
      );
    } finally {
      await workspace.dispose();
    }
  },
);

test(
  'fixed request deadline cannot be extended by a healthy host heartbeat',
  {timeout: 60000},
  async (t) => {
    const f = await fixture(t, {requestDeadlineMs: 500});
    const upload = pendingUpload(f);
    t.after(() => upload.destroy());
    await waitFor(f.held);
    const end = await f.done();
    assert.equal(end.value.reason, 'execution deadline exceeded');
    assert.equal(f.held(), false);
  },
);

test(
  'lease renewal loss stops work and admission fails closed',
  {timeout: 60000},
  async (t) => {
    const f = await fixture(t);
    const upload = pendingUpload(f);
    t.after(() => upload.destroy());
    await waitFor(f.held);
    f.fail();
    const end = await f.done();
    assert.ok(end.error);
    assert.ok(
      f.reports.some((r) => r.reason === 'execution lease unavailable'),
    );
  },
);

test('exact hosted origin allows auth/bootstrap without trusting forwarded headers', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'roomie-origin-'));
  const workspace = await openWorkspace({directory});
  const publicOrigin = 'https://workspace.example.test';
  const server = await startWorkspaceServer({workspace, publicOrigin});
  t.after(async () => {
    await server.dispose();
    await workspace.dispose();
    await rm(directory, {recursive: true, force: true});
  });
  const {token} = JSON.parse(await readFile(server.credentialPath, 'utf8'));
  const good = await http(server.url + '/api/auth/ticket', {
    headers: {
      Authorization: `Bearer ${token}`,
      Host: 'workspace.example.test',
      Origin: publicOrigin,
    },
  });
  assert.equal(good.status, 200);
  assert.ok(good.body.url.startsWith(publicOrigin + '/#'));
  const bad = await http(server.url + '/api/auth/ticket', {
    headers: {
      Authorization: `Bearer ${token}`,
      Host: 'evil.test',
      'X-Forwarded-Host': 'workspace.example.test',
    },
  });
  assert.equal(bad.status, 403);
  const origin = await http(server.url + '/api/auth/ticket', {
    headers: {
      Authorization: `Bearer ${token}`,
      Host: 'workspace.example.test',
      Origin: 'https://evil.test',
    },
  });
  assert.equal(origin.status, 403);
});

test('orphan cleanup retains and renews the execution hold before startup and after exit', async () => {
  const {EventEmitter} = await import('node:events');
  let holds = 0;
  const renewals = [];
  await superviseHost({
    tasks: {
      hold: async () => {
        holds++;
      },
      release: async () => {},
    },
    tickMs: 5,
    renewMs: 10,
    cleanup: async () => {
      const before = holds;
      await delay(100);
      renewals.push(holds - before);
    },
    spawnHost: () => {
      const child = new EventEmitter();
      setTimeout(() => child.emit('message', {type: 'roomie-ready'}), 5);
      setTimeout(() => child.emit('exit', 0), 30);
      return child;
    },
  });
  assert.equal(renewals.length, 2);
  assert.ok(renewals.every((count) => count >= 2));
});

test('first work after idle receives a fresh heartbeat grace interval', async () => {
  const {EventEmitter} = await import('node:events');
  const {randomUUID} = await import('node:crypto');
  const child = new EventEmitter();
  const reports = [];
  const done = superviseHost({
    tasks: {hold: async () => {}, release: async () => {}},
    heartbeatMs: 100,
    tickMs: 5,
    renewMs: 20,
    spawnHost: () => child,
    report: (event) => reports.push(event),
  });
  await waitFor(() => reports.some((e) => e.event === 'host-start'));
  child.emit('message', {type: 'roomie-ready'});
  await delay(200); // Represents a sleeping VM with no heartbeat traffic.
  child.emit('message', {
    type: 'roomie-acquire',
    id: randomUUID(),
    kind: 'request',
  });
  await delay(30);
  const stopped = reports.some((e) => e.event === 'watchdog-stop');
  child.emit('exit', 0);
  await done;
  assert.equal(stopped, false);
});

test('socket close during lease admission cannot create an orphan query session', async (t) => {
  const {WebSocket} = await import('ws');
  const directory = await mkdtemp(join(tmpdir(), 'roomie-admission-'));
  const workspace = await openWorkspace({directory});
  let admit,
    admitted = false,
    sessions = 0;
  const gate = new Promise((resolve) => {
    admit = resolve;
  });
  const original = workspace.createQuerySession;
  workspace.createQuerySession = (...args) => {
    sessions++;
    return original(...args);
  };
  const server = await startWorkspaceServer({
    workspace,
    lifecycle: {
      async acquire(kind) {
        if (kind === 'request') {
          admitted = true;
          await gate;
        }
        return async () => {};
      },
    },
  });
  t.after(async () => {
    admit();
    await server.dispose();
    await workspace.dispose();
    await rm(directory, {recursive: true, force: true});
  });
  const {token} = JSON.parse(await readFile(server.credentialPath, 'utf8'));
  const ws = new WebSocket(server.url.replace('http:', 'ws:') + '/ws');
  await new Promise((resolve) => ws.once('open', resolve));
  ws.send(JSON.stringify({type: 'auth', token}));
  await waitFor(() => admitted);
  ws.close();
  await new Promise((resolve) => ws.once('close', resolve));
  await delay(50);
  admit();
  await delay(50);
  assert.equal(sessions, 0);
});

test(
  'external watchdog reaps an isolated process left behind by a stopped host',
  {skip: !process.env.ROOMIE_ISOLATION_IMAGE, timeout: 60000},
  async (t) => {
    const {mkdir} = await import('node:fs/promises');
    const {prepareIsolatedHarness, recoverIsolatedHarnesses} =
      await import('../dist-test/bridge.mjs');
    let directory;
    const f = await fixture(t, {
      cleanup: async () => {
        if (directory) await recoverIsolatedHarnesses(directory);
      },
    });
    directory = join(f.directory, 'workspace');
    const cwd = join(directory, 'sessions', 'watchdog');
    await mkdir(cwd, {recursive: true});
    const boundary = await prepareIsolatedHarness({
      isolation: {image: process.env.ROOMIE_ISOLATION_IMAGE},
      cwd,
      workspaceDirectory: directory,
      mcpUrl: f.control.url + '/mcp',
      token: 'watchdog-synthetic-token',
      deadlineMs: 60000,
    });
    let ready = false;
    const child = boundary.spawn('node', [
      '-e',
      "console.log('ready');setInterval(()=>{},1000)",
    ]);
    child.stdout.on('data', () => {
      ready = true;
    });
    child.stderr.resume();
    const drained = boundary.done(child);
    t.after(() => boundary.dispose());
    await waitFor(() => ready);
    await waitFor(() => !f.held());
    const upload = pendingUpload(f);
    t.after(() => upload.destroy());
    await waitFor(f.held);
    process.kill(f.child.pid, 'SIGSTOP');
    const end = await f.done();
    assert.equal(end.value.reason, 'host heartbeat expired');
    await drained;
    assert.ok(child.exitCode !== null || child.signalCode !== null);
    assert.equal(f.held(), false);
  },
);

test(
  'drained release never waits for an acknowledgement across an intentional idle transition',
  {timeout: 15000},
  async () => {
    const module = new URL('../service/lease-client.mjs', import.meta.url).href;
    const child = spawn(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `
    import {connectExecutionLifecycle} from ${JSON.stringify(module)};
    const lifecycle=connectExecutionLifecycle();
    const release=await lifecycle.acquire('request');
    await release();
    lifecycle.close();
  `,
      ],
      {stdio: ['ignore', 'pipe', 'pipe', 'ipc']},
    );
    let released = false;
    child.on('message', (message) => {
      if (message.type === 'roomie-acquire')
        child.send({type: 'roomie-lease-response', id: message.id, ok: true});
      if (message.type === 'roomie-release') released = true; // No response: the VM may now idle.
    });
    const code = await new Promise((resolve) => child.once('exit', resolve));
    assert.equal(code, 0);
    assert.equal(released, true);
  },
);
