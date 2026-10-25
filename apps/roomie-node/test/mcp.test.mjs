import assert from 'node:assert/strict';
import {http} from './http.mjs';
import {mkdtemp, readFile, stat, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, dirname} from 'node:path';
import {test} from 'node:test';
import {setTimeout as delay} from 'node:timers/promises';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {
  openWorkspace,
  openMetadata,
  startWorkspaceServer,
} from '../dist/index.mjs';

export async function fixture(t, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'roomie-mcp-test-'));
  const workspace = await openWorkspace({directory, ...options});
  const server = await startWorkspaceServer({
    workspace,
    policy: options.policy,
  });
  const credential = JSON.parse(await readFile(server.credentialPath, 'utf8'));
  t.after(async () => {
    await server.dispose();
    await workspace.dispose();
    await rm(directory, {recursive: true, force: true});
  });
  return {directory, workspace, server, credential};
}
async function client(t, endpoint, token) {
  const client = new Client({name: 'M1b external client', version: '1'});
  await client.connect(
    new StreamableHTTPClientTransport(new URL(endpoint), {
      requestInit: {headers: {Authorization: `Bearer ${token}`}},
    }),
  );
  t.after(() => client.close());
  return client;
}
const create = {
  name: 'execute_command',
  arguments: {
    commandId: 'block-document.create',
    input: {title: 'External report'},
    commit: {operationId: 'create'},
  },
};
const call = async (client, args) =>
  (await client.callTool(args)).structuredContent;

test('official MCP client creates, reads and revises durable content; retry survives server restart', async (t) => {
  const {directory, workspace, server, credential} = await fixture(t);
  const remote = await client(t, server.mcpUrl, credential.token);
  assert.ok(
    remote.getServerCapabilities().experimental['sqlrooms/durable-content-v1'],
  );
  const result = await call(remote, create);
  assert.equal(result.ok, true);
  const receipt = result.data.receipt;
  assert.equal(receipt.revision, 1);
  assert.deepEqual(await call(remote, create), result);
  const read = await call(remote, {
    name: 'execute_command',
    arguments: {
      commandId: 'block-document.get',
      input: {artifactId: receipt.artifactId},
    },
  });
  assert.equal(read.data.revision, 1);
  const rename = {
    name: 'execute_command',
    arguments: {
      commandId: 'block-document.rename',
      input: {artifactId: receipt.artifactId, title: 'Revised'},
      commit: {
        operationId: 'rename',
        artifactId: receipt.artifactId,
        expectedRevision: 1,
      },
    },
  };
  assert.equal((await call(remote, rename)).data.receipt.revision, 2);
  assert.equal(
    (
      await call(remote, {
        ...rename,
        arguments: {
          ...rename.arguments,
          commit: {...rename.arguments.commit, operationId: 'stale'},
        },
      })
    ).code,
    'revision-conflict',
  );
  assert.equal((await workspace.events())[0].user_id, 'owner');
  await remote.close();
  await server.dispose();
  await workspace.dispose();
  await assert.rejects(stat(server.credentialPath), {code: 'ENOENT'});
  const reopened = await openWorkspace({directory});
  const restarted = await startWorkspaceServer({workspace: reopened});
  try {
    const fresh = JSON.parse(await readFile(restarted.credentialPath, 'utf8'));
    const stale = await fetch(restarted.mcpUrl, {
      method: 'POST',
      headers: {Authorization: `Bearer ${credential.token}`},
    });
    assert.equal(stale.status, 401);
    const next = await client(t, restarted.mcpUrl, fresh.token);
    assert.deepEqual(await call(next, create), result);
    await next.close();
  } finally {
    await restarted.dispose();
    await reopened.dispose();
  }
});

test('writes reject missing metadata, mismatched targets, input reuse and client identity spoofing', async (t) => {
  const {workspace, server, credential} = await fixture(t);
  const remote = await client(t, server.mcpUrl, credential.token);
  assert.equal(
    (
      await call(remote, {
        ...create,
        arguments: {...create.arguments, commit: undefined},
      })
    ).code,
    'invalid_input',
  );
  assert.equal((await workspace.events()).length, 0);
  const result = await call(remote, {
    ...create,
    _meta: {principalId: 'attacker', actor: 'attacker'},
  });
  assert.equal((await workspace.events())[0].user_id, 'owner');
  assert.equal(
    (
      await call(remote, {
        ...create,
        arguments: {...create.arguments, input: {title: 'Changed'}},
      })
    ).ok,
    false,
  );
  const bad = await call(remote, {
    name: 'execute_command',
    arguments: {
      commandId: 'block-document.rename',
      input: {artifactId: 'another-document', title: 'Bad'},
      commit: {
        operationId: 'mismatch',
        artifactId: result.data.receipt.artifactId,
        expectedRevision: 1,
      },
    },
  });
  assert.equal(bad.ok, false);
  assert.equal((await workspace.events()).length, 1);
});

test('real persistence failure is an MCP error and retry commits once', async (t) => {
  let fail = true;
  const {workspace, server, credential} = await fixture(t, {
    openMetadata: (path) => {
      const db = openMetadata(path);
      return {
        ...db,
        commit: (value) => {
          if (fail) {
            fail = false;
            throw new Error('injected disk failure');
          }
          return db.commit(value);
        },
      };
    },
  });
  const remote = await client(t, server.mcpUrl, credential.token);
  assert.equal((await call(remote, create)).ok, false);
  assert.equal((await workspace.events()).length, 0);
  assert.equal((await call(remote, create)).ok, true);
  assert.equal((await workspace.events()).length, 1);
});

test('private credentials, every-request auth, origin/Host checks and workspace isolation', async (t) => {
  const a = await fixture(t);
  const b = await fixture(t);
  assert.equal((await stat(a.server.credentialPath)).mode & 0o777, 0o600);
  assert.equal(
    (await stat(dirname(a.server.credentialPath))).mode & 0o777,
    0o700,
  );
  for (const method of ['GET', 'POST', 'DELETE']) {
    for (const token of ['', 'invalid', b.credential.token]) {
      const response = await fetch(a.server.mcpUrl, {
        method,
        headers: {Authorization: `Bearer ${token}`},
      });
      assert.equal(response.status, 401);
      assert.equal(response.headers.get('cache-control'), 'no-store');
    }
  }
  for (const headers of [
    {Origin: 'https://evil.invalid'},
    {Origin: 'null'},
    {Host: 'evil.invalid'},
    {Origin: `${a.server.url}.evil.invalid`},
  ]) {
    assert.equal(
      (
        await http(a.server.mcpUrl, {
          headers: {Authorization: `Bearer ${a.credential.token}`, ...headers},
        })
      ).status,
      403,
    );
  }
  assert.equal(
    (
      await fetch(`${a.server.url}/mcp?token=${a.credential.token}`, {
        method: 'POST',
      })
    ).status,
    404,
  );
  const identity = await (await fetch(`${a.server.url}/auth.json`)).json();
  assert.deepEqual(identity, {binding: a.server.binding});
});

test('bootstrap tickets are single-use, owner-only, cross-workspace rejected and page credentials cannot call MCP', async (t) => {
  const a = await fixture(t);
  const b = await fixture(t);
  const post = (path, body, token = a.credential.token, url = a.server.url) =>
    fetch(`${url}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  assert.equal((await post('/api/auth/ticket', {}, '')).status, 401);
  const launch = await (await post('/api/auth/ticket', {})).json();
  const ticket = new URLSearchParams(new URL(launch.url).hash.slice(1)).get(
    'sqlrooms-ticket',
  );
  assert.equal(
    (await post('/api/auth/exchange', {ticket}, '', b.server.url)).status,
    401,
  );
  const exchanges = await Promise.all([
    post('/api/auth/exchange', {ticket}, ''),
    post('/api/auth/exchange', {ticket}, ''),
  ]);
  assert.deepEqual(exchanges.map((r) => r.status).sort(), [200, 401]);
  const page = await exchanges.find((r) => r.status === 200).json();
  assert.equal((await post('/mcp', {}, page.token)).status, 403);
  assert.equal((await post('/api/auth/ticket', {}, page.token)).status, 403);
  assert.equal(
    (await post('/api/auth/renew', {}, a.credential.token)).status,
    403,
  );
  assert.equal((await post('/api/auth/renew', {}, page.token)).status, 200);
  assert.equal(
    (await post('/api/auth/exchange', {ticket: 'x'.repeat(5000)}, '')).status,
    413,
  );
  assert.equal(
    (await post('/mcp', {oversized: 'x'.repeat(256 * 1024)})).status,
    413,
  );
});

test('a policy resolving after shutdown cannot start a mutation', async (t) => {
  let authorize;
  let admitted;
  const entered = new Promise((resolve) => {
    admitted = resolve;
  });
  const {workspace, server, credential} = await fixture(t, {
    policy: {
      authorize: () => {
        admitted();
        return new Promise((resolve) => {
          authorize = resolve;
        });
      },
    },
  });
  const remote = await client(t, server.mcpUrl, credential.token);
  const response = call(remote, create).catch(() => undefined);
  await entered;
  await server.dispose();
  authorize({allowed: true});
  await response;
  await delay(20);
  assert.equal((await workspace.events()).length, 0);
});

test('caller disconnect and shutdown drain an already admitted durable mutation', async (t) => {
  let release;
  let started;
  const preparation = new Promise((resolve) => {
    release = resolve;
  });
  const entered = new Promise((resolve) => {
    started = resolve;
  });
  const {workspace, server, credential} = await fixture(t, {
    prepareCommand: async () => {
      started();
      await preparation;
    },
  });
  const remote = await client(t, server.mcpUrl, credential.token);
  const response = call(remote, create).catch(() => undefined);
  await entered;
  await remote.close();
  let closed = false;
  const closing = server.dispose().then(() => {
    closed = true;
  });
  await delay(20);
  assert.equal(closed, false);
  assert.equal((await workspace.events()).length, 0);
  release();
  await closing;
  await response;
  assert.equal((await workspace.events()).length, 1);
});

test('shutdown removes credential material even if workspace flush fails closed', async () => {
  const server = await startWorkspaceServer({
    workspace: {
      flush: async () => {
        throw new Error('storage fault');
      },
    },
  });
  await assert.rejects(server.dispose(), /storage fault/);
  await assert.rejects(stat(server.credentialPath), {code: 'ENOENT'});
});
