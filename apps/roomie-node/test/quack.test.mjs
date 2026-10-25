import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {test} from 'node:test';
import {DuckDBInstance} from '@duckdb/node-api';
import {
  openWorkspace,
  openMetadata,
  importWorkspaceBundle,
} from '../dist/index.mjs';

test('opt-in native Quack authenticates clients and shares the native analytics owner', async () => {
  const portProbe = createServer();
  await new Promise((resolve) => portProbe.listen(0, '127.0.0.1', resolve));
  const port = portProbe.address().port;
  await new Promise((resolve) => portProbe.close(resolve));
  const directory = await mkdtemp(join(tmpdir(), 'roomie-quack-test-'));
  const uri = `quack:127.0.0.1:${port}`;
  const token = randomBytes(32).toString('hex');
  let fail = false;
  const host = await openWorkspace({
    directory,
    quack: {uri, token},
    openMetadata: (path) => {
      const db = openMetadata(path);
      return {
        ...db,
        commit: async (value) => {
          if (fail) throw new Error('simulated failed commit');
          await db.commit(value);
        },
      };
    },
  });
  const client = await DuckDBInstance.create(':memory:');
  const connection = await client.connect();
  try {
    assert.equal(host.quack, 'enabled');
    await connection.run('LOAD quack');
    await assert.rejects(
      connection.run(`ATTACH '${uri}' AS denied (TOKEN 'bad-token')`),
      /auth|token|401|403/i,
    );
    await connection.run(
      `ATTACH '${uri}' AS workspace (TOKEN '${token}'); CONNECT workspace`,
    );
    const version = (
      await connection.runAndReadAll('SELECT version() AS version')
    ).getRowObjectsJson();
    assert.equal(version[0].version, 'v2.0.0');
    const receipt = await host.mutate({
      commandId: 'block-document.create',
      operationId: 'create',
      principalId: 'owner',
    });
    // Exercise fresh catalog state following complete content reconstruction.
    const request = {
      commandId: 'block-document.rename',
      operationId: 'failed',
      principalId: 'owner',
      artifactId: receipt.artifactId,
      expectedRevision: 1,
      input: {artifactId: receipt.artifactId, title: 'rejected'},
    };
    fail = true;
    await assert.rejects(host.mutate(request), /simulated/);
    fail = false;
    await connection.run('CREATE TABLE sales AS SELECT 1::INTEGER AS amount');
    const chart = await host.mutate({
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
    assert.equal(chart.revision, 2);
    assert.equal(chart.result.data.blockId, 'chart');
    // Export stops the real Quack writer before checkpointing the analytical file.
    let stop = false;
    let writes = 0;
    const writing = (async () => {
      while (!stop) {
        try {
          await connection.run('INSERT INTO sales VALUES (2)');
          writes++;
        } catch {
          break;
        } // quack_stop disconnects the remote session.
      }
    })();
    const bundle = join(directory, 'quack.roomie');
    try {
      await host.exportBundle(bundle);
    } finally {
      stop = true;
      await writing;
    }
    await importWorkspaceBundle(bundle, join(directory, 'restored'));
    const restored = await openWorkspace({
      directory: join(directory, 'restored'),
    });
    try {
      const count = (await restored.query('SELECT count(*) AS n FROM sales'))
        .getChild('n')
        .get(0);
      assert.ok(count >= 1n && count <= BigInt(writes + 1));
      assert.equal(
        (await restored.snapshot()).revisions[receipt.artifactId],
        2,
      );
    } finally {
      await restored.dispose();
    }
  } finally {
    connection.closeSync();
    client.closeSync();
    await host.dispose();
    await rm(directory, {recursive: true, force: true});
  }
});
