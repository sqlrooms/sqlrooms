import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {createInterface} from 'node:readline';
import {once} from 'node:events';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {openWorkspace} from '../dist/index.mjs';
test('process crash recovers committed content and interrupts a live approval without replaying it', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'roomie-run-crash-'));
  const seed = await openWorkspace({directory});
  const receipt = await seed.mutate({
    operationId: 'seed',
    principalId: 'owner',
    commandId: 'block-document.create',
    input: {title: 'Recovered report'},
  });
  await seed.dispose();
  const child = spawn(process.execPath, ['test/recovery-host.mjs', directory], {
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const lines = createInterface({input: child.stdout});
  const [line] = await once(lines, 'line');
  t.diagnostic('Host listening');
  const {url, credentialPath} = JSON.parse(line);
  lines.close();
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL');
      await once(child, 'exit');
    }
    await rm(directory, {recursive: true, force: true});
  });
  const {token} = JSON.parse(await readFile(credentialPath, 'utf8'));
  const request = async (path, body) => {
    const response = await fetch(url + path, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? {'Content-Type': 'application/json'} : {}),
      },
      ...(body ? {method: 'POST', body: JSON.stringify(body)} : {}),
    });
    return response.json();
  };
  const run = await request('/api/runs/start', {
    idempotencyKey: 'pending',
    text: 'Request approval',
  });
  let pending = [];
  for (let i = 0; i < 100; i++) {
    pending = await request('/api/approvals');
    if (pending.length) break;
    await delay(20);
  }
  assert.equal(pending.length, 1);
  t.diagnostic('Approval pending');
  const exited = once(child, 'exit');
  child.kill('SIGKILL');
  await exited;
  t.diagnostic('Host killed');
  const recovered = await openWorkspace({directory});
  try {
    const snapshot = await recovered.snapshot();
    assert.equal(snapshot.revisions[receipt.artifactId], 1);
    assert.equal(recovered.runs.get(run.runId).status, 'interrupted');
    assert.equal(recovered.runs.pending().length, 0);
    assert.match(recovered.runs.events(0).at(-1).payload.reason, /restarted/);
    assert.throws(
      () =>
        recovered.runs.resolveApproval(
          pending[0].approvalId,
          'approve',
          'owner',
        ),
      /conflict/,
    );
  } finally {
    await recovered.dispose();
  }
});
