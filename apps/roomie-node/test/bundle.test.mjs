import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm, mkdir, writeFile, readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openWorkspace, importWorkspaceBundle} from '../dist/index.mjs';
const capabilities = {
  liveInput: false,
  continueSession: false,
  approvalRecovery: false,
  cancelTurn: true,
  reasoningSummary: false,
  planUpdates: false,
  usage: false,
};
test('versioned bundles round-trip data, exact content, stable IDs, assets and explicit history policy', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'roomie-bundle-test-'));
  const workspace = await openWorkspace({directory: join(root, 'source')});
  t.after(async () => {
    await workspace.dispose();
    await rm(root, {recursive: true, force: true});
  });
  await workspace.upload(
    {operationId: 'result-42', tableName: 'retained_result_42', format: 'csv'},
    Buffer.from('month,amount\nJanuary,300.00\nFebruary,450.00\n'),
  );
  let receipt = await workspace.mutate({
    operationId: 'document',
    principalId: 'owner',
    commandId: 'block-document.create',
    input: {
      title: 'Report',
      blocks: [
        {
          id: 'notes',
          type: 'paragraph',
          text: 'Order grain; whole-order refund exclusion.',
        },
      ],
    },
  });
  receipt = await workspace.mutate({
    operationId: 'table',
    principalId: 'owner',
    artifactId: receipt.artifactId,
    expectedRevision: 1,
    commandId: 'block-document.create-stateful-block',
    input: {
      artifactId: receipt.artifactId,
      blockId: 'stable-block',
      blockInstanceId: 'stable-result-reference',
      blockType: 'data-table',
      tableName: 'retained_result_42',
    },
  });
  await mkdir(join(root, 'source', 'assets'));
  await writeFile(
    join(root, 'source', 'assets', '来源 résumé.txt'),
    'retained result provenance',
  );
  const {run} = workspace.runs.start(
    {idempotencyKey: 'run', text: 'private conversation'},
    'owner',
    capabilities,
    'hash',
    1000,
  );
  workspace.runs.finish(run.runId, 'succeeded', 'complete');
  const before = await workspace.snapshot();
  for (const includeHistory of [false, true]) {
    const bundle = join(root, `report-${includeHistory}.roomie`);
    const target = join(root, `target-${includeHistory}`);
    await workspace.exportBundle(bundle, {includeHistory});
    await importWorkspaceBundle(bundle, target);
    const restored = await openWorkspace({directory: target});
    try {
      assert.deepEqual((await restored.snapshot()).content, before.content);
      assert.deepEqual((await restored.snapshot()).revisions, before.revisions);
      assert.equal(
        (
          await restored.query(
            'SELECT SUM(amount) AS n FROM retained_result_42',
          )
        )
          .getChild('n')
          .get(0),
        750,
      );
      assert.equal(
        restored.runs.conversations().length,
        includeHistory ? 1 : 0,
      );
      assert.equal(
        await readFile(join(target, 'assets', '来源 résumé.txt'), 'utf8'),
        'retained result provenance',
      );
      const blocks = (
        await restored.read('block-document.get', {
          artifactId: receipt.artifactId,
        })
      ).data.blocks;
      assert.equal(blocks[1].id, 'stable-block');
      assert.equal(blocks[1].blockInstanceId, 'stable-result-reference');
      assert.equal(blocks[1].tableName, 'retained_result_42');
    } finally {
      await restored.dispose();
    }
    await assert.rejects(importWorkspaceBundle(bundle, target), /exist/);
    await assert.rejects(workspace.exportBundle(bundle), /exist/);
  }
  const corrupt = Buffer.from(
    await readFile(join(root, 'report-false.roomie')),
  );
  corrupt[corrupt.length - 1] ^= 1;
  await writeFile(join(root, 'corrupt.roomie'), corrupt);
  await assert.rejects(
    importWorkspaceBundle(join(root, 'corrupt.roomie'), join(root, 'bad')),
    /checksum/,
  );
});

test('an accepted export completes when shutdown starts immediately', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'roomie-export-drain-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  const workspace = await openWorkspace({directory: join(root, 'source')});
  const exportWork = workspace.exportBundle(join(root, 'snapshot.roomie'));
  await workspace.dispose();
  await exportWork;
  await importWorkspaceBundle(
    join(root, 'snapshot.roomie'),
    join(root, 'restored'),
  );
});

test('HTML revisions with absent optional metadata survive restart and bundle recovery', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'roomie-html-recovery-'));
  let workspace = await openWorkspace({directory: join(root, 'source')});
  t.after(async () => {
    await workspace.dispose();
    await rm(root, {recursive: true, force: true});
  });
  let receipt = await workspace.mutate({
    commandId: 'block-document.create',
    operationId: 'doc',
    principalId: 'owner',
  });
  receipt = await workspace.mutate({
    commandId: 'block-document.create-stateful-block',
    operationId: 'html',
    principalId: 'owner',
    artifactId: receipt.artifactId,
    expectedRevision: 1,
    input: {
      artifactId: receipt.artifactId,
      blockId: 'html-block',
      blockInstanceId: 'html',
      blockType: 'html-app',
    },
  });
  receipt = await workspace.mutate({
    commandId: 'html-app.write-revision',
    operationId: 'revision',
    principalId: 'owner',
    artifactId: receipt.artifactId,
    expectedRevision: 2,
    input: {
      appId: 'html',
      patch: {files: {'/index.html': '<h1>Recovered HTML</h1>'}},
    },
  });
  await workspace.dispose();
  workspace = await openWorkspace({directory: join(root, 'source')});
  assert.equal(
    (await workspace.snapshot()).content.htmlApps.appsById.html.files[
      '/index.html'
    ],
    '<h1>Recovered HTML</h1>',
  );
  await workspace.exportBundle(join(root, 'html.roomie'));
  await importWorkspaceBundle(
    join(root, 'html.roomie'),
    join(root, 'restored'),
  );
  const restored = await openWorkspace({directory: join(root, 'restored')});
  try {
    assert.equal(
      (await restored.snapshot()).content.htmlApps.appsById.html.revisions
        .length,
      1,
    );
  } finally {
    await restored.dispose();
  }
});
