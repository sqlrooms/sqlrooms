import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtemp, rm, symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, relative} from 'node:path';
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
    // CONNECT sends these statements to the real server instance, bypassing
    // browser/MCP parsing. Metadata/file safety must hold in DuckDB itself.
    const settings = Object.fromEntries(
      (
        await connection.runAndReadAll(
          "SELECT name, value FROM duckdb_settings() WHERE name IN ('lock_configuration','enable_external_access','allowed_paths','allowed_directories','allow_persistent_secrets','autoload_known_extensions','autoinstall_known_extensions')",
        )
      )
        .getRowObjectsJson()
        .map(({name, value}) => [name, value]),
    );
    assert.equal(settings.lock_configuration, 'true');
    assert.equal(settings.enable_external_access, 'false');
    // DuckDB automatically permits only its own database/WAL paths on lock.
    assert.ok(!settings.allowed_paths.includes('meta.sqlite'));
    assert.ok(
      settings.allowed_paths
        .split(',')
        .every((path) => path.includes('/data.duckdb')),
    );
    assert.equal(settings.allow_persistent_secrets, 'false');
    assert.equal(settings.autoload_known_extensions, 'false');
    assert.equal(settings.autoinstall_known_extensions, 'false');
    const exchange = settings.allowed_directories
      .slice(1, -1)
      .split(', ')
      .find((path) => path.includes('/roomie-exchange-'));
    assert.ok(exchange);
    await symlink(join(directory, 'meta.sqlite'), join(exchange, 'escape'));
    const traversal =
      exchange + '/' + relative(exchange, join(directory, 'meta.sqlite'));
    const privatePath = join(directory, 'meta.sqlite').replaceAll("'", "''");
    for (const sql of [
      `SELECT * FROM read_blob('${exchange}/escape')`,
      `SELECT * FROM read_blob('${traversal}')`,
      'SET enable_external_access=true',
      'SET lock_configuration=false',
      "SET allowed_directories=['/']",
      `SET allowed_paths=['${privatePath}']`,
      "SET allowed_configs=['enable_external_access']",
      'RESET enable_external_access',
      'INSTALL sqlite',
      'LOAD sqlite',
      `ATTACH '${privatePath}' AS stolen (TYPE SQLITE)`,
      `ATTACH '${privatePath}' AS stolen`,
      `SELECT * FROM read_blob('${privatePath}')`,
      `SELECT * FROM read_text('${privatePath}-wal')`,
      `SELECT * FROM read_csv('${privatePath}')`,
      `COPY (SELECT 'overwrite') TO '${privatePath}'`,
      `CREATE VIEW hidden AS SELECT * FROM read_blob('${privatePath}')`,
      `SELECT 1; SELECT * FROM read_blob('${privatePath}')`,
      `SELECT * FROM read_text('http://127.0.0.1:1/private')`,
    ]) {
      await assert.rejects(
        connection.run(sql),
        /disabled|locked|access|permission/i,
        sql,
      );
    }
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
