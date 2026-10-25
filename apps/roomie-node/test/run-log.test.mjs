import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openMetadata, openWorkspace} from '../dist/index.mjs';
import {
  HarnessRunEvent,
  HarnessConversationSnapshot,
} from '../../../packages/ai-config/dist/harnessRun.js';
const capabilities = {
  liveInput: false,
  continueSession: false,
  approvalRecovery: false,
  cancelTurn: true,
  reasoningSummary: false,
  planUpdates: false,
  usage: false,
};
async function fixture(fn) {
  const directory = await mkdtemp(join(tmpdir(), 'roomie-events-'));
  let metadata = openMetadata(join(directory, 'meta.sqlite'));
  try {
    await fn(metadata, () => {
      metadata.close();
      metadata = openMetadata(join(directory, 'meta.sqlite'));
      return metadata;
    });
  } finally {
    metadata.close();
    await rm(directory, {recursive: true, force: true});
  }
}
test('run starts are idempotent, one active run, decisions are durable and first-wins', async () =>
  fixture(async (db, reopen) => {
    const request = {idempotencyKey: 'one', text: 'Hello'};
    const {run} = db.runs.start(request, 'owner', capabilities, 'hash', 1000);
    assert.equal(
      db.runs.start(request, 'owner', capabilities, 'hash', 1000).created,
      false,
    );
    assert.throws(
      () =>
        db.runs.start(
          {...request, text: 'Other'},
          'owner',
          capabilities,
          'hash',
          1000,
        ),
      /idempotency/,
    );
    assert.throws(
      () =>
        db.runs.start(
          {...request, idempotencyKey: 'two'},
          'owner',
          capabilities,
          'hash',
          1000,
        ),
      /active/,
    );
    db.runs.started(run.runId, 'native');
    const approval = db.runs.requestApproval(run.runId, 'call', 'Approve?');
    assert.equal(db.runs.get(run.runId).status, 'awaiting-approval');
    db = reopen();
    assert.equal(db.runs.pending().length, 1);
    db.runs.resolveApproval(approval.approvalId, 'deny', 'owner');
    assert.equal(
      db.runs.resolveApproval(approval.approvalId, 'deny', 'owner').changed,
      false,
    );
    assert.throws(
      () => db.runs.resolveApproval(approval.approvalId, 'approve', 'owner'),
      /conflict/,
    );
    db.runs.finish(run.runId, 'cancelled', 'Owner cancelled.');
    assert.equal(db.runs.get(run.runId).status, 'cancelled');
    const events = db.runs.events(0);
    events.forEach((event) => HarnessRunEvent.parse(event));
    assert.deepEqual(
      events.map((e) => e.seq),
      events.map((_, i) => i + 1),
    );
    HarnessConversationSnapshot.parse(db.runs.snapshot(run.conversationId));
  }));
test('recovery marks unfinished runs interrupted and invalidates pending native approvals', async () =>
  fixture(async (db, reopen) => {
    const {run} = db.runs.start(
      {idempotencyKey: 'start', text: 'Work'},
      'owner',
      capabilities,
      'hash',
      1000,
    );
    const approval = db.runs.requestApproval(run.runId, 'rpc', 'Pending');
    db = reopen();
    db.runs.recover();
    assert.equal(db.runs.get(run.runId).status, 'interrupted');
    assert.equal(db.runs.pending().length, 0);
    assert.throws(
      () => db.runs.resolveApproval(approval.approvalId, 'approve', 'owner'),
      /conflict/,
    );
    const size = db.runs.events(0).length;
    db.runs.recover();
    assert.equal(db.runs.events(0).length, size);
  }));
test('committed replay and blobs redact known tokens and preserve oversized message identity', async () =>
  fixture(async (db) => {
    const {run} = db.runs.start(
      {idempotencyKey: 'start', text: 'Work'},
      'owner',
      capabilities,
      'hash',
      1000,
    );
    db.runs.setSecrets(['test-secret']);
    const event = db.runs.append(run.runId, 'message.text', {
      messageId: 'message',
      text: 'test-secret' + 'x'.repeat(20000),
    });
    assert.equal(event.payload.messageId, 'message');
    assert.ok(event.blobRef);
    assert.ok(!db.runs.blob(event.blobRef).includes('test-secret'));
    assert.equal(db.runs.events(event.seq - 1)[0].eventId, event.eventId);
    assert.throws(() =>
      HarnessRunEvent.parse({
        ...event,
        kind: 'run.status',
        payload: {status: 'bogus'},
      }),
    );
    HarnessRunEvent.parse({
      ...event,
      kind: 'future.kind',
      payload: {future: true},
    });
  }));
test('failed startup run recovery releases the native owner for retry', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'roomie-recover-fail-'));
  try {
    await assert.rejects(
      openWorkspace({
        directory,
        openMetadata: (path) => {
          const db = openMetadata(path);
          return {
            ...db,
            runs: {
              ...db.runs,
              recover() {
                throw new Error('recovery failed');
              },
            },
          };
        },
      }),
      /recovery failed/,
    );
    const workspace = await openWorkspace({directory});
    await workspace.dispose();
  } finally {
    await rm(directory, {recursive: true, force: true});
  }
});
