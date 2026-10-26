import assert from 'node:assert/strict';
import {readFile, mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createInterface} from 'node:readline';
import {setTimeout as delay} from 'node:timers/promises';
import {test} from 'node:test';
import {DuckDBInstance} from '@duckdb/node-api';
import {openWorkspace, startWorkspaceServer} from '../dist/index.mjs';
import {connectBridge} from '../dist-test/bridge.mjs';
import {http} from './http.mjs';
import {exerciseWebSocket} from './websocket-conformance.mjs';

const fixtures = JSON.parse(
  await readFile(
    new URL('../../../tests/protocol/mcp.json', import.meta.url),
    'utf8',
  ),
);
const python = process.env.ROOMIE_CONFORMANCE_PYTHON;
if (!python)
  throw new Error(
    'Set ROOMIE_CONFORMANCE_PYTHON to the Python workspace interpreter; both servers are required.',
  );

for (const kind of ['node', 'python']) {
  test(`${kind}: shared MCP/auth/bootstrap conformance`, async (t) => {
    const dir = await mkdtemp(join(tmpdir(), 'roomie-conformance-'));
    const cleanup = [() => rm(dir, {recursive: true, force: true})];
    t.after(async () => {
      for (const dispose of cleanup.reverse()) await dispose();
    });
    let host;
    if (kind === 'node') {
      const db = await DuckDBInstance.create(join(dir, 'data.duckdb'));
      const connection = await db.connect();
      await connection.run(
        'CREATE TABLE conformance_numbers AS SELECT i FROM range(1000) AS t(i); CREATE TABLE conformance_types AS SELECT [1,2] AS nested',
      );
      connection.closeSync();
      db.closeSync();
      const workspace = await openWorkspace({directory: dir});
      host = await startWorkspaceServer({
        workspace,
        policy: {
          authorize: ({input}) =>
            input.input?.title === 'denied'
              ? {
                  allowed: false,
                  result: {
                    ok: false,
                    code: 'policy_denied',
                    message: 'Fixture host policy.',
                  },
                }
              : {allowed: true},
        },
      });
      cleanup.push(async () => {
        await host.dispose();
        await workspace.dispose();
      });
    } else {
      const child = spawn(python, [resolve('test/python-server.py'), dir], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stderr = '';
      child.stderr.on('data', (data) => {
        stderr += data;
      });
      const lines = createInterface({input: child.stdout});
      cleanup.push(async () => {
        if (child.exitCode === null) {
          child.kill('SIGTERM');
          await once(child, 'exit');
        }
        lines.close();
      });
      host = await Promise.race([
        once(lines, 'line').then(([line]) => JSON.parse(line)),
        once(child, 'exit').then(() => {
          throw new Error(stderr || 'Python exited before startup.');
        }),
      ]);
      let ready = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        try {
          ready =
            (await http(`${host.url}/auth.json`, {method: 'GET'})).status ===
            200;
        } catch {}
        if (ready) break;
        await delay(50);
      }
      assert.equal(ready, true, stderr);
    }
    const foreignWorkspace = await openWorkspace({
      directory: join(dir, 'foreign'),
    });
    const foreignServer = await startWorkspaceServer({
      workspace: foreignWorkspace,
    });
    cleanup.push(async () => {
      await foreignServer.dispose();
      await foreignWorkspace.dispose();
    });
    const foreignCredential = JSON.parse(
      await readFile(foreignServer.credentialPath, 'utf8'),
    );
    const credentials = JSON.parse(await readFile(host.credentialPath, 'utf8'));
    await exerciseWebSocket(t, kind, host.url, credentials.token);
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': fixtures.protocolVersion,
      Authorization: `Bearer ${credentials.token}`,
    };
    const post = (path, body, override = {}) =>
      http(`${host.url}${path}`, {headers: {...headers, ...override}, body});
    let id = 0;
    const rpc = async (method, params) => {
      const requestId = ++id;
      const result = await post('/mcp', {
        jsonrpc: '2.0',
        id: requestId,
        method,
        params,
      });
      assert.equal(result.status, 200, JSON.stringify(result));
      assert.equal(result.body.id, requestId);
      assert.equal(result.headers['cache-control'], 'no-store');
      assert.equal(result.headers['referrer-policy'], 'no-referrer');
      return result.body.result;
    };
    const ticketResponse = await post('/api/auth/ticket', {});
    const ticketUrl = new URL(ticketResponse.body.url);
    const ticket = new URLSearchParams(ticketUrl.hash.slice(1)).get(
      'sqlrooms-ticket',
    );
    assert.ok(ticket);
    const page = await post(
      '/api/auth/exchange',
      {ticket},
      {Authorization: ''},
    );
    assert.equal(page.status, 200);
    assert.equal(
      (await post('/api/auth/exchange', {ticket}, {Authorization: ''})).status,
      401,
    );
    assert.equal(
      (
        await post(
          '/api/auth/ticket',
          {},
          {Authorization: `Bearer ${page.body.token}`},
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await post(
          '/api/auth/renew',
          {},
          {Authorization: `Bearer ${page.body.token}`},
        )
      ).status,
      200,
    );
    if (kind === 'python')
      cleanup.push(
        await connectBridge(
          host.url.replace('http:', 'ws:') + '/ws/mcp-bridge',
          page.body.token,
        ),
      );
    await rpc('initialize', {
      protocolVersion: fixtures.protocolVersion,
      capabilities: {},
      clientInfo: {name: 'shared-conformance', version: '1'},
    });
    const discovered = await rpc('tools/list', {});
    for (const name of fixtures.tools) {
      const descriptor = discovered.tools.find((tool) => tool.name === name);
      assert.equal(descriptor?.inputSchema.type, 'object');
    }
    for (const fixture of fixtures.calls)
      await t.test(fixture.name, async () => {
        const result = await rpc('tools/call', {
          name: fixture.tool,
          arguments: {
            ...fixture.input,
            ...(kind === 'node' && fixture.mutation
              ? {commit: {operationId: fixture.name}}
              : {}),
          },
        });
        const value = result.structuredContent;
        assert.equal(result.isError, fixture.ok !== true);
        assert.deepEqual(JSON.parse(result.content[0].text), value);
        assert.equal(value.ok, fixture.ok === true);
        if (fixture.code) assert.equal(value.code, fixture.code);
        if (fixture.name === 'inspect command')
          assert.equal(value.data.command.id, 'block-document.list');
        if (fixture.name === 'multiword command search')
          assert.ok(
            value.data.commands.some(
              (command) => command.id === 'block-document.create',
            ),
          );
        if (fixture.name === 'create document')
          assert.equal(typeof value.data.data.artifactId, 'string');
        if (fixture.name === 'search command')
          assert.ok(
            value.data.commands.some(
              (command) => command.id === 'block-document.list',
            ),
          );
      });
    const tokens = {
      missing: '',
      invalid: 'invalid',
      foreign: foreignCredential.token,
      page: page.body.token,
      owner: credentials.token,
    };
    for (const fixture of fixtures.admission)
      await t.test(fixture.name, async () => {
        const result = await post(
          '/mcp',
          {jsonrpc: '2.0', id: ++id, method: 'tools/list'},
          {
            Authorization: `Bearer ${tokens[fixture.token]}`,
            ...fixture.headers,
          },
        );
        assert.equal(result.status, fixture.status);
        assert.equal(result.headers['cache-control'], 'no-store');
      });
  });
}
