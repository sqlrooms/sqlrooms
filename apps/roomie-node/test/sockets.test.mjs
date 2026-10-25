import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openWorkspace, startWorkspaceServer} from '../dist/index.mjs';
import {socketClient} from './websocket-conformance.mjs';
const capabilities = {
  liveInput: false,
  continueSession: false,
  approvalRecovery: false,
  cancelTurn: true,
  reasoningSummary: false,
  planUpdates: false,
  usage: false,
};
test('reconnect replays every durable event after the last cursor with no gap', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'roomie-replay-'));
  const workspace = await openWorkspace({directory});
  const server = await startWorkspaceServer({workspace});
  t.after(async () => {
    await server.dispose();
    await workspace.dispose();
    await rm(directory, {recursive: true, force: true});
  });
  assert.equal((await fetch(server.url + '/api/catalog')).status, 401);
  assert.equal((await fetch(server.url + '/api/approvals')).status, 401);
  const {token} = JSON.parse(await readFile(server.credentialPath, 'utf8'));
  const first = await socketClient(server.url, token);
  first.send({type: 'run-subscribe', afterSeq: 0});
  const {run} = workspace.runs.start(
    {idempotencyKey: 'one', text: 'Work'},
    'owner',
    capabilities,
    'hash',
    10000,
  );
  const received = [];
  for (let i = 0; i < 3; i++) received.push((await first.next()).event);
  await first.close();
  workspace.runs.started(run.runId, 'native');
  workspace.runs.append(run.runId, 'message.text', {
    messageId: 'answer',
    text: 'Finished offline',
  });
  workspace.runs.finish(run.runId, 'succeeded', 'Done');
  const second = await socketClient(server.url, token);
  second.send({type: 'run-subscribe', afterSeq: received.at(-1).seq});
  const remaining = workspace.runs.events(received.at(-1).seq);
  for (let i = 0; i < remaining.length; i++)
    received.push((await second.next()).event);
  assert.deepEqual(received, workspace.runs.events(0));
  second.send({type: 'arrow', queryId: 'invalid', sql: ''});
  const invalid = await second.next();
  assert.equal(invalid.queryId, 'invalid');
  assert.equal(invalid.type, 'error');
  await assert.rejects(
    workspace.query("DESCRIBE SELECT * FROM read_csv('/not-authorized.csv')"),
    /ordinary local data/,
  );
  await second.close();
});
