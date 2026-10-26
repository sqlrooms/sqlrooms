import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm, readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {DuckDBInstance, DuckDBBlobValue} from '@duckdb/node-api';
import {LoroDoc} from 'loro-crdt';
import {legacyDocumentSnapshot} from '../dist-test/bridge.mjs';
import {DatabaseSync} from 'node:sqlite';
import {
  openWorkspace,
  migrateLegacyWorkspace,
  openMetadata,
} from '../dist/index.mjs';

test('offline v1/v2 and content snapshots migrate into new workspaces with original backups and stable IDs', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'roomie-migration-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  const seed = await openWorkspace({directory: join(root, 'seed')});
  const receipt = await seed.mutate({
    commandId: 'block-document.create',
    operationId: 'create',
    principalId: 'owner',
    input: {
      title: 'Legacy',
      blocks: [{id: 'stable', type: 'paragraph', text: 'Preserve me'}],
    },
  });
  const {content} = await seed.snapshot();
  await seed.dispose();
  for (const mode of ['v1', 'v2', 'snapshot', 'shared', 'both', 'future']) {
    const source = join(root, mode + '.duckdb');
    const db = await DuckDBInstance.create(source, {
      storage_compatibility_version: 'v1.4.0',
    });
    const c = await db.connect();
    try {
      await c.run(
        'CREATE SCHEMA __roomie; CREATE TABLE sales AS SELECT 300 AS amount; CREATE TABLE __roomie.ui_state(key VARCHAR, payload_json JSON); CREATE TABLE __roomie.sync_rooms(room_id VARCHAR, snapshot BLOB)',
      );
      if (mode !== 'snapshot' && mode !== 'shared')
        await c.run("INSERT INTO __roomie.ui_state VALUES ('default',$1)", [
          JSON.stringify({
            state: {
              ...content,
              application: 'roomie',
              schemaVersion: mode === 'future' ? 99 : mode === 'v1' ? 1 : 2,
              ...(mode === 'v1' ? {tableExplorers: {byId: {}}} : {}),
            },
          }),
        ]);
      if (mode === 'snapshot' || mode === 'shared' || mode === 'both') {
        const doc = new LoroDoc();
        for (const [key, value] of Object.entries(content))
          for (const [k, v] of Object.entries(value)) doc.getMap(key).set(k, v);
        doc.commit();
        await c.run("INSERT INTO __roomie.sync_rooms VALUES ('workspace',$1)", [
          new DuckDBBlobValue(
            mode === 'shared'
              ? legacyDocumentSnapshot(content)
              : doc.export({mode: 'snapshot'}),
          ),
        ]);
        doc.free();
      }
    } finally {
      c.closeSync();
      db.closeSync();
    }
    const backup = await readFile(source);
    const destination = join(root, mode);
    if (mode === 'future') {
      await assert.rejects(migrateLegacyWorkspace({source, destination}));
      continue;
    }
    if (mode === 'both')
      await assert.rejects(
        migrateLegacyWorkspace({source, destination}),
        /select envelope or snapshot/,
      );
    await migrateLegacyWorkspace({
      source,
      destination,
      ...(mode === 'both' ? {contentSource: 'envelope'} : {}),
    });
    const restored = await openWorkspace({directory: destination});
    try {
      assert.deepEqual((await restored.snapshot()).content, content);
      assert.equal(
        (
          await restored.read('block-document.get', {
            artifactId: receipt.artifactId,
          })
        ).revision,
        1,
      );
      assert.equal(
        (await restored.query('SELECT amount FROM sales'))
          .getChild('amount')
          .get(0),
        300,
      );
    } finally {
      await restored.dispose();
    }
    assert.deepEqual(await readFile(source), backup);
    await assert.rejects(
      migrateLegacyWorkspace({
        source,
        destination,
        ...(mode === 'both' ? {contentSource: 'envelope'} : {}),
      }),
      /exist/,
    );
  }
});
test('metadata v3 upgrades preserve identity; future versions are refused', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'roomie-schema-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  const path = join(root, 'meta.sqlite');
  let metadata = openMetadata(path);
  const id = metadata.workspaceId;
  metadata.close();
  let db = new DatabaseSync(path);
  db.exec('DROP TABLE data_effects; PRAGMA user_version=3');
  db.close();
  metadata = openMetadata(path);
  assert.equal(metadata.workspaceId, id);
  assert.deepEqual(metadata.dataEffects.pending(), []);
  metadata.close();
  db = new DatabaseSync(path);
  db.exec('PRAGMA user_version=99');
  db.close();
  assert.throws(() => openMetadata(path), /Unsupported/);
});

test('migration rebinds qualified analytical sources without rewriting prose or changing IDs', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'roomie-qualified-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  const seed = await openWorkspace({directory: join(root, 'seed')});
  await seed.upload(
    {operationId: 'sales', tableName: 'sales', format: 'csv'},
    Buffer.from('amount\n300\n450'),
  );
  let receipt = await seed.mutate({
    commandId: 'block-document.create',
    operationId: 'doc',
    principalId: 'owner',
    input: {
      blocks: [
        {
          id: 'prose',
          type: 'paragraph',
          text: 'legacy.main.sales is the original source',
        },
      ],
    },
  });
  receipt = await seed.mutate({
    commandId: 'block-document.create-chart-block',
    operationId: 'chart',
    principalId: 'owner',
    artifactId: receipt.artifactId,
    expectedRevision: 1,
    input: {
      artifactId: receipt.artifactId,
      blockId: 'chart',
      tableName: 'sales',
      config: {chartType: 'histogram', settings: {field: 'amount'}},
    },
  });
  receipt = await seed.mutate({
    commandId: 'block-document.create-stateful-block',
    operationId: 'table',
    principalId: 'owner',
    artifactId: receipt.artifactId,
    expectedRevision: 2,
    input: {
      artifactId: receipt.artifactId,
      blockId: 'table',
      blockInstanceId: 'table-state',
      blockType: 'data-table',
      tableName: 'sales',
    },
  });
  const {content} = await seed.snapshot();
  await seed.dispose();
  const nodes =
    content.blockDocuments.artifacts[receipt.artifactId].content.content;
  for (const node of nodes)
    if (node.attrs?.tableName) node.attrs.tableName = '"legacy"."main"."sales"';
  const source = join(root, 'legacy.duckdb'),
    destination = join(root, 'restored');
  const db = await DuckDBInstance.create(source);
  const c = await db.connect();
  await c.run(
    'CREATE TABLE sales AS SELECT 300 AS amount; CREATE SCHEMA __roomie; CREATE TABLE __roomie.ui_state(key VARCHAR,payload_json JSON)',
  );
  await c.run("INSERT INTO __roomie.ui_state VALUES ('default',$1)", [
    JSON.stringify({application: 'roomie', schemaVersion: 2, ...content}),
  ]);
  c.closeSync();
  db.closeSync();
  const original = await readFile(source);
  await migrateLegacyWorkspace({source, destination});
  assert.deepEqual(await readFile(source), original);
  const restored = await openWorkspace({directory: destination});
  try {
    const saved = (await restored.snapshot()).content.blockDocuments.artifacts[
      receipt.artifactId
    ].content.content;
    assert.equal(
      saved[0].content[0].text,
      'legacy.main.sales is the original source',
    );
    for (const node of saved)
      if (node.attrs?.tableName) {
        assert.equal(node.attrs.tableName, '"data"."main"."sales"');
        assert.equal(
          (await restored.query('SELECT * FROM ' + node.attrs.tableName))
            .numRows,
          1,
        );
      }
  } finally {
    await restored.dispose();
  }
});
