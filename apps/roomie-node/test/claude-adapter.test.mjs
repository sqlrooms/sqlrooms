import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {setTimeout as delay} from 'node:timers/promises';
import {openWorkspace, startWorkspaceServer} from '../dist/index.mjs';
async function wait(fn) {
  for (let i = 0; i < 300; i++) {
    const value = fn();
    if (value) return value;
    await delay(20);
  }
  throw Error('Timed out');
}
async function fixture(t, deadlineMs = 10000) {
  const directory = await mkdtemp(join(tmpdir(), 'roomie-claude-adapter-'));
  const workspace = await openWorkspace({directory});
  const server = await startWorkspaceServer({
    workspace,
    harness: {
      trustedLocal: true,
      adapter: 'claude',
      executable: resolve('test/scripted-claude.mjs'),
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
    const r = await fetch(server.url + path, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    return {status: r.status, data: await r.json()};
  };
  const start = async (text) =>
    (await post('/api/runs/start', {idempotencyKey: text, text})).data;
  return {workspace, server, post, start, directory};
}
test('Claude uses durable shared events and skill identity, redacts credentials and reports capabilities', async (t) => {
  const {workspace, start, directory} = await fixture(t);
  const run = await start('hello');
  await wait(() => workspace.runs.get(run.runId).status === 'succeeded');
  const record = workspace.runs.get(run.runId),
    events = workspace.runs.events(0);
  assert.equal(record.nativeSessionId, 'scripted-claude-session');
  assert.equal(record.capabilities.usage, true);
  assert.equal(record.capabilities.continueSession, false);
  assert.equal(
    events.find((e) => e.kind === 'message.text').payload.text,
    '[REDACTED] Claude hello',
  );
  assert.equal(
    events.find((e) => e.kind === 'usage').payload.usage.output_tokens,
    3,
  );
  assert.equal(
    await readFile(
      join(directory, 'skills', record.skillHash, 'SKILL.md'),
      'utf8',
    ),
    await readFile(
      join(directory, 'sessions', run.runId, '.claude/skills/roomie/SKILL.md'),
      'utf8',
    ),
  );
});
for (const decision of ['approve', 'deny'])
  test(`Claude ${decision} decisions wait durably and preserve tool outcome`, async (t) => {
    const {workspace, start, post} = await fixture(t);
    const run = await start('request approval');
    const approval = await wait(() => workspace.runs.pending()[0]);
    await delay(100);
    assert.equal(workspace.runs.get(run.runId).status, 'awaiting-approval');
    assert.equal(
      (
        await post('/api/approvals/resolve', {
          approvalId: approval.approvalId,
          decision,
        })
      ).status,
      200,
    );
    await wait(() => workspace.runs.get(run.runId).status === 'succeeded');
    assert.equal(
      workspace.runs.events(0).find((e) => e.kind === 'tool.completed').payload
        .status,
      decision === 'approve' ? 'completed' : 'denied',
    );
    assert.equal(
      (
        await post('/api/approvals/resolve', {
          approvalId: approval.approvalId,
          decision: decision === 'approve' ? 'deny' : 'approve',
        })
      ).status,
      409,
    );
  });
for (const prompt of [
  'api error',
  'bad exit',
  'unexpected tools',
  'oversized',
  'approval native cancel',
])
  test(`Claude fails closed for ${prompt}`, async (t) => {
    const {workspace, start} = await fixture(t);
    const run = await start(prompt);
    await wait(() => workspace.runs.get(run.runId).status === 'failed');
    assert.equal(workspace.runs.pending().length, 0);
  });
test('Claude cancellation and restart do not recover native approval IDs', async (t) => {
  const {workspace, start, post, server} = await fixture(t);
  const run = await start('request approval');
  await wait(() => workspace.runs.pending()[0]);
  assert.equal(
    (await post('/api/runs/cancel', {runId: run.runId})).status,
    200,
  );
  assert.equal(workspace.runs.get(run.runId).status, 'cancelled');
  assert.equal(workspace.runs.pending().length, 0);
  const second = await start('next approval');
  await wait(() => workspace.runs.pending()[0]);
  await server.dispose();
  assert.equal(workspace.runs.get(second.runId).status, 'interrupted');
  assert.equal(workspace.runs.pending().length, 0);
});
test('Claude hard deadline interrupts without a browser', async (t) => {
  const {workspace, start} = await fixture(t, 300);
  const run = await start('wait forever');
  await wait(() => workspace.runs.get(run.runId).status === 'interrupted');
});

for (const mode of ['receipt', 'receipt text array', 'command failure'])
  test(`Claude preserves shared command ${mode}`, async (t) => {
    const {workspace, start, post} = await fixture(t);
    const run = await start('approval ' + mode);
    const approval = await wait(() => workspace.runs.pending()[0]);
    await post('/api/approvals/resolve', {
      approvalId: approval.approvalId,
      decision: 'approve',
    });
    await wait(() => workspace.runs.get(run.runId).status === 'succeeded');
    const event = workspace.runs
      .events(0)
      .find((e) => e.kind === 'tool.completed');
    assert.equal(event.payload.toolClass, 'roomie-command');
    assert.equal(
      event.payload.status,
      mode === 'command failure' ? 'failed' : 'completed',
    );
    if (mode !== 'command failure') {
      assert.equal(event.payload.operationId, 'op-1');
      assert.deepEqual(event.payload.artifactRefs, [{artifactId: 'doc-1'}]);
    }
    assert.equal(workspace.runs.get(run.runId).harness, 'claude');
  });
