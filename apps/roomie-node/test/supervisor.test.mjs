import {test} from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {setTimeout as delay} from 'node:timers/promises';
import {openWorkspace, startWorkspaceServer} from '../dist/index.mjs';
async function waitFor(fn) {
  for (let i = 0; i < 150; i++) {
    const result = fn();
    if (result) return result;
    await delay(20);
  }
  throw new Error('Timed out');
}
async function fixture(t, deadlineMs = 5000, lifecycle) {
  const directory = await mkdtemp(join(tmpdir(), 'roomie-supervisor-'));
  const workspace = await openWorkspace({directory});
  const server = await startWorkspaceServer({
    workspace,
    lifecycle,
    harness: {
      trustedLocal: true,
      executable: resolve('test/scripted-codex.mjs'),
      deadlineMs,
    },
  });
  const {token} = JSON.parse(await readFile(server.credentialPath, 'utf8'));
  t.after(async () => {
    await server.dispose();
    await workspace.dispose();
    await rm(directory, {recursive: true, force: true});
  });
  const post = async (path, body) => {
    const response = await fetch(server.url + path, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    return {status: response.status, data: await response.json()};
  };
  return {workspace, server, post};
}
test('headless supervised process persists redacted messages and terminal events without a browser', async (t) => {
  const {workspace, post} = await fixture(t);
  const {data: run, status} = await post('/api/runs/start', {
    idempotencyKey: 'hello',
    text: 'Say hello',
  });
  assert.equal(status, 200);
  await waitFor(() => workspace.runs.get(run.runId).status === 'succeeded');
  const events = workspace.runs.events(0);
  assert.equal(
    events.find((e) => e.kind === 'message.text').payload.text,
    '[REDACTED] Hello',
  );
  assert.equal(
    events.find((e) => e.kind === 'tool.completed').payload.result,
    '[REDACTED]',
  );
  assert.ok(!JSON.stringify(events).includes('outputDelta'));
  assert.deepEqual(
    events.map((event) => event.kind),
    [
      'run.status',
      'turn.started',
      'message.user',
      'run.status',
      'tool.completed',
      'message.text',
      'message.completed',
      'turn.completed',
      'run.status',
    ],
  );
  assert.equal(events.at(-1).payload.status, 'succeeded');
  assert.equal(
    workspace.runs.get(run.runId).nativeSessionId,
    'scripted-native',
  );
});
test('approval waits with no browser, persists once, and explicit denial reaches native harness', async (t) => {
  const {workspace, post} = await fixture(t);
  const {data: run} = await post('/api/runs/start', {
    idempotencyKey: 'approve',
    text: 'Request approval',
  });
  const approval = await waitFor(() => workspace.runs.pending()[0]);
  await delay(200);
  assert.equal(workspace.runs.get(run.runId).status, 'awaiting-approval');
  assert.equal(
    (
      await post('/api/approvals/resolve', {
        approvalId: approval.approvalId,
        decision: 'deny',
      })
    ).status,
    200,
  );
  await waitFor(() => workspace.runs.get(run.runId).status === 'succeeded');
  assert.equal(
    (
      await post('/api/approvals/resolve', {
        approvalId: approval.approvalId,
        decision: 'approve',
      })
    ).status,
    409,
  );
  assert.equal(
    workspace.runs.events(0).find((e) => e.kind === 'message.text').payload
      .text,
    'decline',
  );
});
test('owner cancellation and hard deadline end a headless run; one active run enforced', async (t) => {
  const {workspace, post} = await fixture(t, 800);
  await assert.rejects(
    startWorkspaceServer({workspace, harness: {trustedLocal: false}}),
    /trustedLocal/,
  );
  const {data: run} = await post('/api/runs/start', {
    idempotencyKey: 'hang',
    text: 'hang',
  });
  assert.equal(
    (await post('/api/runs/start', {idempotencyKey: 'second', text: 'Hi'}))
      .status,
    409,
  );
  await waitFor(() => workspace.runs.get(run.runId).status === 'running');
  assert.equal(
    (await post('/api/runs/cancel', {runId: run.runId})).data.status,
    'cancelled',
  );
  await delay(100);
  const {data: next, status} = await post('/api/runs/start', {
    idempotencyKey: 'deadline',
    text: 'hang',
  });
  assert.equal(status, 200);
  await waitFor(() => workspace.runs.get(next.runId).status === 'interrupted');
  assert.match(workspace.runs.events(0).at(-1).payload.reason, /deadline/);
});

test('approval granted reaches the native harness and terminal state admits the next turn immediately', async (t) => {
  const {workspace, post} = await fixture(t);
  const {data: run} = await post('/api/runs/start', {
    idempotencyKey: 'grant',
    text: 'Request approval',
  });
  const approval = await waitFor(() => workspace.runs.pending()[0]);
  assert.equal(
    (
      await post('/api/approvals/resolve', {
        approvalId: approval.approvalId,
        decision: 'approve',
      })
    ).status,
    200,
  );
  await waitFor(() => workspace.runs.get(run.runId).status === 'succeeded');
  assert.equal(
    workspace.runs.events(0).find((e) => e.kind === 'message.text').payload
      .text,
    'accept',
  );
  const next = await post('/api/runs/start', {
    idempotencyKey: 'next',
    conversationId: run.conversationId,
    text: 'Next turn',
  });
  assert.equal(next.status, 200);
  await waitFor(
    () => workspace.runs.get(next.data.runId).status === 'succeeded',
  );
});

test('event persistence failure revokes work and does not publish a false terminal success', async (t) => {
  const {workspace, post, server} = await fixture(t);
  const db = new DatabaseSync(join(workspace.directory, 'meta.sqlite'));
  db.exec(
    `CREATE TRIGGER fail_message BEFORE INSERT ON run_events WHEN json_extract(NEW.record, '$.kind')='message.text' BEGIN SELECT RAISE(FAIL, 'injected write failure'); END;`,
  );
  const {data: run} = await post('/api/runs/start', {
    idempotencyKey: 'storage',
    text: 'Hello',
  });
  await delay(500);
  assert.notEqual(workspace.runs.get(run.runId).status, 'succeeded');
  assert.ok(
    !workspace.runs.events(0).some((event) => event.kind === 'message.text'),
  );
  assert.equal(
    (await post('/api/runs/start', {idempotencyKey: 'blocked', text: 'Again'}))
      .status,
    503,
  );
  db.exec('DROP TRIGGER fail_message');
  db.close();
  await server.dispose();
  await workspace.dispose();
  const recovered = await openWorkspace({directory: workspace.directory});
  try {
    assert.equal(recovered.runs.get(run.runId).status, 'interrupted');
  } finally {
    await recovered.dispose();
  }
});

test('approval wait retains its run lease until deadline, process drain, and terminal persistence', async (t) => {
  const leases = new Set();
  let terminalAtRelease;
  const lifecycle = {
    async acquire(kind) {
      const lease = {kind};
      leases.add(lease);
      return async () => {
        if (kind === 'run') terminalAtRelease = workspace.runs.events(0).at(-1);
        leases.delete(lease);
      };
    },
  };
  const {workspace, post} = await fixture(t, 1200, lifecycle);
  const {data: run} = await post('/api/runs/start', {
    idempotencyKey: 'lease-wait',
    text: 'Request approval',
  });
  await waitFor(() => workspace.runs.pending()[0]);
  assert.ok([...leases].some((lease) => lease.kind === 'run'));
  assert.equal(workspace.runs.get(run.runId).status, 'awaiting-approval');
  await waitFor(() => terminalAtRelease);
  assert.equal(terminalAtRelease.kind, 'run.status');
  assert.equal(terminalAtRelease.payload.status, 'interrupted');
  assert.equal(leases.size, 0);
});
