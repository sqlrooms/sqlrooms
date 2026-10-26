import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, rm, readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {setTimeout as delay} from 'node:timers/promises';
import {
  prepareIsolatedHarness,
  recoverIsolatedHarnesses,
} from '../dist-test/bridge.mjs';
import {openWorkspace, startWorkspaceServer} from '../dist/index.mjs';
const isolation = {
  backend: 'bubblewrap',
  runtimeDirectory: process.env.ROOMIE_BWRAP_RUNTIME,
};
const enabled = {skip: !process.env.ROOMIE_BWRAP_RUNTIME, timeout: 120000};
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'ri-'));
  const cwd = join(root, 'sessions', 'run');
  await mkdir(cwd, {recursive: true});
  t.after(async () => {
    await recoverIsolatedHarnesses(root, isolation);
    await rm(root, {recursive: true, force: true});
  });
  return {root, cwd};
}
async function wait(fn) {
  for (let i = 0; i < 500; i++) {
    const v = await fn();
    if (v) return v;
    await delay(20);
  }
  throw new Error('Timed out');
}
test(
  'Bubblewrap shared adapter redacts delegated keys and preserves scoped commands, approval and cancellation',
  enabled,
  async (t) => {
    const {root} = await fixture(t);
    const workspace = await openWorkspace({directory: join(root, 'workspace')});
    const server = await startWorkspaceServer({
      workspace,
      harness: {
        adapter: 'claude',
        isolation: {
          ...isolation,
          modelEnvironment: {OPENAI_API_KEY: 'model-secret-echo'},
        },
        executable: '/runtime/test-claude.mjs',
        deadlineMs: 20000,
      },
    });
    t.after(async () => {
      await server.dispose();
      await workspace.dispose();
    });
    const {token} = JSON.parse(await readFile(server.credentialPath, 'utf8'));
    async function post(path, body) {
      const r = await fetch(server.url + path, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      assert.equal(r.status, 200);
      return r.json();
    }
    const otherWorkspace = await openWorkspace({
      directory: join(root, 'other-workspace'),
    });
    const otherServer = await startWorkspaceServer({workspace: otherWorkspace});
    t.after(async () => {
      await otherServer.dispose();
      await otherWorkspace.dispose();
    });
    const otherAddress = new URL(otherServer.mcpUrl);
    const otherHost = otherAddress.host;
    const probe = await post('/api/runs/start', {
      idempotencyKey: 'bypass',
      text:
        'bypass suite:' +
        JSON.stringify({
          other: otherAddress.href,
          otherHost,
          metadata: join(workspace.directory, 'meta.sqlite'),
        }),
    });
    await wait(() => workspace.runs.get(probe.runId).status === 'succeeded');
    const findings = JSON.parse(
      workspace.runs
        .events(0)
        .find((e) => e.runId === probe.runId && e.kind === 'message.text')
        .payload.text,
    );
    assert.equal(findings.ticket.status, 403);
    assert.equal(findings.approval.status, 403);
    assert.equal(findings.other.status, 403);
    assert.equal(findings.query.body.result.structuredContent.ok, false);
    assert.equal(findings.create.body.result.structuredContent.ok, true);
    const artifact =
      findings.create.body.result.structuredContent.data.receipt.artifactId;
    assert.equal((await workspace.snapshot()).revisions[artifact], 1);
    const a = await post('/api/runs/start', {
      idempotencyKey: 'key echo',
      text: 'key echo',
    });
    await wait(() => workspace.runs.get(a.runId).status === 'succeeded');
    assert.ok(
      !JSON.stringify(workspace.runs.events(0)).includes('model-secret-echo'),
    );
    assert.match(
      workspace.runs
        .events(0)
        .find((e) => e.runId === a.runId && e.kind === 'message.text').payload
        .text,
      /\[REDACTED\].*\[REDACTED\]/,
    );
    const b = await post('/api/runs/start', {
      idempotencyKey: 'approval',
      text: 'approval',
    });
    await wait(() => workspace.runs.pending().length);
    assert.equal(workspace.runs.get(b.runId).status, 'awaiting-approval');
    await post('/api/runs/cancel', {runId: b.runId});
    assert.equal(workspace.runs.get(b.runId).status, 'cancelled');
    assert.equal(workspace.runs.pending().length, 0);
    // Cancel while namespace preparation is still in flight; terminal waits for cleanup.
    const c = await post('/api/runs/start', {
      idempotencyKey: 'startup-cancel',
      text: 'hello',
    });
    await post('/api/runs/cancel', {runId: c.runId});
    assert.equal(workspace.runs.get(c.runId).status, 'cancelled');
  },
);
test(
  'Bubblewrap explicit Codex API-key delegation initializes only the disposable model home',
  enabled,
  async (t) => {
    const {root, cwd} = await fixture(t);
    const boundary = await prepareIsolatedHarness({
      isolation: {
        ...isolation,
        modelEnvironment: {OPENAI_API_KEY: 'sk-roomie-synthetic-login-only'},
      },
      cwd,
      workspaceDirectory: root,
      mcpUrl: 'http://127.0.0.1:1/mcp',
      token: 'fake',
      deadlineMs: 10000,
    });
    const child = boundary.spawn('codex', ['login', 'status']);
    let output = '';
    child.stdout.on('data', (x) => (output += x));
    child.stderr.on('data', (x) => (output += x));
    await boundary.done(child);
    assert.equal(child.exitCode, 0, output);
    assert.match(output, /API key/i);
    await assert.rejects(readFile(join(cwd, '.codex', 'auth.json')));
  },
);

test(
  'real isolated Codex app-server commits through shared MCP with a credential-free scripted model (Bubblewrap)',
  enabled,
  async (t) => {
    const {createServer} = await import('node:http');
    const {mkdirSync, writeFileSync} = await import('node:fs');
    const {root} = await fixture(t);
    let requests = 0,
      seenTools = [],
      received = [];
    const model = createServer(async (request, response) => {
      let raw = '';
      for await (const chunk of request) raw += chunk;
      const body = JSON.parse(raw);
      received.push(body.input);
      requests++;
      const tools = (body.tools ?? []).flatMap((tool) =>
        tool.type === 'namespace'
          ? (tool.tools ?? []).map((child) => ({
              ...child,
              name: child.name,
              namespace: tool.name,
            }))
          : [tool],
      );
      seenTools = tools.map((tool) => tool.name);
      const command = tools.find(
        (tool) =>
          tool.namespace?.includes('roomie') &&
          tool.name === (requests === 1 ? 'query' : 'execute_command'),
      );
      const item =
        requests <= 2 && command
          ? {
              id: 'fc' + requests,
              type: 'function_call',
              call_id: 'call' + requests,
              name: command.name,
              namespace: command.namespace,
              arguments: JSON.stringify(
                requests === 1
                  ? {
                      sql: `SELECT * FROM read_blob('${join(root, 'workspace', 'meta.sqlite')}')`,
                    }
                  : {
                      commandId: 'block-document.create',
                      input: {title: 'Real isolated Codex'},
                      commit: {operationId: 'real-isolated-codex'},
                    },
              ),
              status: 'completed',
            }
          : {
              id: 'msg1',
              type: 'message',
              role: 'assistant',
              status: 'completed',
              content: [
                {type: 'output_text', text: 'Shared command completed.'},
              ],
            };
      response.writeHead(200, {'content-type': 'text/event-stream'});
      const emit = (type, data) =>
        response.write(
          `event: ${type}\ndata: ${JSON.stringify({type, ...data})}\n\n`,
        );
      emit('response.created', {
        response: {
          id: 'response' + requests,
          status: 'in_progress',
          output: [],
        },
      });
      emit('response.output_item.added', {output_index: 0, item});
      emit('response.output_item.done', {output_index: 0, item});
      emit('response.completed', {
        response: {
          id: 'response' + requests,
          status: 'completed',
          output: [item],
          usage: {input_tokens: 1, output_tokens: 1, total_tokens: 2},
        },
      });
      response.end();
    });
    await new Promise((resolve) => model.listen(0, '127.0.0.1', resolve));
    t.after(() => {
      model.closeAllConnections();
      model.close();
    });
    const url = `http://127.0.0.1:${model.address().port}/v1`;
    const workspace = await openWorkspace({
      directory: join(root, 'workspace'),
    });
    const original = workspace.runs.start;
    workspace.runs.start = (...args) => {
      const result = original(...args);
      if (result.created) {
        const cwd = join(workspace.directory, 'sessions', result.run.runId);
        mkdirSync(cwd, {recursive: true});
        writeFileSync(join(cwd, 'provider.json'), JSON.stringify({url}));
      }
      return result;
    };
    const server = await startWorkspaceServer({
      workspace,
      harness: {
        adapter: 'codex',
        isolation: {
          ...isolation,
          modelOrigins: [new URL(url).origin],
        },
        executable: '/runtime/test-codex.mjs',
        model: 'fixture-model',
        deadlineMs: 20000,
      },
    });
    t.after(async () => {
      await server.dispose();
      await workspace.dispose();
    });
    const {token} = JSON.parse(await readFile(server.credentialPath, 'utf8'));
    const response = await fetch(server.url + '/api/runs/start', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        idempotencyKey: 'native-codex',
        text: 'Use the shared command to create the report.',
      }),
    });
    assert.equal(response.status, 200);
    const run = await response.json();
    await wait(() =>
      ['succeeded', 'failed', 'interrupted'].includes(
        workspace.runs.get(run.runId).status,
      ),
    );
    assert.equal(
      workspace.runs.get(run.runId).status,
      'succeeded',
      JSON.stringify(workspace.runs.events(0)),
    );
    assert.ok(
      workspace.runs
        .events(0)
        .some(
          (e) =>
            e.kind === 'tool.completed' &&
            e.payload.name === 'query' &&
            e.payload.status === 'failed',
        ),
    );
    const event = workspace.runs
      .events(0)
      .find(
        (e) =>
          e.kind === 'tool.completed' &&
          e.payload.operationId === 'real-isolated-codex',
      );
    assert.ok(
      event,
      JSON.stringify({
        seenTools,
        received: received
          .flat()
          .filter((item) => item.type === 'function_call_output'),
        events: workspace.runs
          .events(0)
          .filter((event) => event.kind.startsWith('tool.')),
      }),
    );
    assert.equal(
      (await workspace.snapshot()).revisions[
        event.payload.artifactRefs[0].artifactId
      ],
      1,
    );
  },
);

test('obsolete and unknown isolation profiles fail before recovery or launch', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'roomie-retired-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  const workspace = await openWorkspace({directory: root});
  t.after(() => workspace.dispose());
  for (const retired of [
    undefined,
    {image: 'sha256:' + 'a'.repeat(64)},
    {backend: 'docker', image: 'sha256:' + 'a'.repeat(64)},
    {backend: 'unknown', runtimeDirectory: '/unused'},
    {backend: 'bubblewrap', runtimeDirectory: '/unused', image: 'obsolete'},
    {backend: 'bubblewrap'},
  ]) {
    await assert.rejects(
      recoverIsolatedHarnesses(root, retired),
      /explicit Bubblewrap runtime/,
    );
    await assert.rejects(
      prepareIsolatedHarness({
        isolation: retired,
        cwd: root,
        workspaceDirectory: root,
        mcpUrl: 'http://127.0.0.1:1/mcp',
        token: 'synthetic',
        deadlineMs: 1000,
      }),
      /explicit Bubblewrap runtime/,
    );
    if (retired)
      await assert.rejects(
        startWorkspaceServer({workspace, harness: {isolation: retired}}),
        /explicit Bubblewrap runtime/,
      );
  }
});

test('missing Bubblewrap runtime never falls back to a host process', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'roomie-missing-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  await assert.rejects(
    prepareIsolatedHarness({
      isolation: {
        backend: 'bubblewrap',
        runtimeDirectory: join(root, 'missing'),
      },
      cwd: root,
      workspaceDirectory: root,
      mcpUrl: 'http://127.0.0.1:1/mcp',
      token: 'synthetic',
      deadlineMs: 1000,
    }),
    /ENOENT|unprivileged Linux host/,
  );
});

test('live acceptance driver rejects retired image environment before creating its workspace', async (t) => {
  const {execFile} = await import('node:child_process');
  const {promisify} = await import('node:util');
  const {stat} = await import('node:fs/promises');
  const root = await mkdtemp(join(tmpdir(), 'roomie-driver-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  const directory = join(root, 'must-not-exist');
  await assert.rejects(
    promisify(execFile)(
      process.execPath,
      [new URL('./live-m2.mjs', import.meta.url).pathname],
      {
        env: {
          ...process.env,
          ROOMIE_M2_DIRECTORY: directory,
          ROOMIE_ISOLATION_IMAGE: 'sha256:' + 'a'.repeat(64),
        },
      },
    ),
    /ROOMIE_ISOLATION_IMAGE is no longer supported/,
  );
  await assert.rejects(stat(directory), {code: 'ENOENT'});
});
