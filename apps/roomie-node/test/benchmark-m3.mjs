// Reproducible opt-in workload: pnpm --filter roomie-node exec node test/benchmark-m3.mjs
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtemp, rm, readFile} from 'node:fs/promises';
import {tmpdir, cpus} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {performance} from 'node:perf_hooks';
import {DuckDBInstance} from '@duckdb/node-api';
import {
  openWorkspace,
  startWorkspaceServer,
  importWorkspaceBundle,
} from '../dist/index.mjs';
import {socketClient} from './websocket-conformance.mjs';
const root = await mkdtemp(join(tmpdir(), 'roomie-m3-load-'));
const probe = createServer();
await new Promise((r) => probe.listen(0, '127.0.0.1', r));
const port = probe.address().port;
await new Promise((r) => probe.close(r));
const token = randomBytes(32).toString('hex'),
  uri = `quack:127.0.0.1:${port}`;
const workspace = await openWorkspace({
  directory: join(root, 'source'),
  quack: {uri, token},
});
const native = await DuckDBInstance.create(':memory:');
const remote = await native.connect();
let server, client;
const stats = (values) => {
  const sorted = values.toSorted((a, b) => a - b);
  return {
    samples: values.length,
    p50: sorted[Math.floor(sorted.length * 0.5)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    max: sorted.at(-1),
  };
};
try {
  await remote.run(
    `LOAD quack; ATTACH '${uri}' AS workspace (TOKEN '${token}'); CONNECT workspace`,
  );
  await remote.run(
    'CREATE TABLE load_data AS SELECT i, i%100 AS category, i*0.01 AS amount FROM range(1000000) t(i)',
  );
  await workspace.refresh();
  server = await startWorkspaceServer({workspace});
  const owner = JSON.parse(await readFile(server.credentialPath, 'utf8')).token;
  client = await socketClient(server.url, owner);
  let receipt = await workspace.mutate({
    commandId: 'block-document.create',
    operationId: 'doc',
    principalId: 'owner',
    input: {title: 'Load fixture'},
  });
  const caps = {
    liveInput: false,
    continueSession: false,
    approvalRecovery: false,
    cancelTurn: true,
    reasoningSummary: false,
    planUpdates: false,
    usage: false,
  };
  const {run} = workspace.runs.start(
    {idempotencyKey: 'run', text: 'Synthetic benchmark'},
    'owner',
    caps,
    'hash',
    60000,
  );
  const results = {};
  for (const loaded of [false, true]) {
    let stop = false;
    let iterations = 0;
    const load = loaded
      ? (async () => {
          while (!stop) {
            await remote.run(
              'SELECT category,sum(sqrt(amount)),avg(amount) FROM load_data GROUP BY 1',
            );
            iterations++;
          }
        })()
      : Promise.resolve();
    const filtering = [],
      metadata = [],
      events = [];
    try {
      for (let i = 0; i < 50; i++) {
        let start = performance.now();
        client.send({
          type: 'arrow',
          queryId: `q-${loaded}-${i}`,
          sql: `SELECT category, sum(amount) AS amount FROM load_data WHERE category BETWEEN ${i % 80} AND ${(i % 80) + 10} GROUP BY 1`,
        });
        const frame = await client.next();
        assert.ok(Buffer.isBuffer(frame), JSON.stringify(frame));
        filtering.push(performance.now() - start);
        start = performance.now();
        receipt = await workspace.mutate({
          commandId: 'block-document.rename',
          operationId: `edit-${loaded}-${i}`,
          principalId: 'owner',
          artifactId: receipt.artifactId,
          expectedRevision: receipt.revision,
          input: {artifactId: receipt.artifactId, title: `Load ${i}`},
        });
        assert.ok(receipt.revision);
        metadata.push(performance.now() - start);
        start = performance.now();
        workspace.runs.append(
          run.runId,
          'message.delta',
          {text: 'x'.repeat(1024)},
          `event-${loaded}-${i}`,
        );
        events.push(performance.now() - start);
      }
    } finally {
      stop = true;
      await load;
    }
    results[loaded ? 'analyticalAndQuackLoad' : 'idle'] = {
      filterRoundTripMs: stats(filtering),
      commandCommitMs: stats(metadata),
      eventCommitMs: stats(events),
      quackQueries: iterations,
    };
  }
  workspace.runs.finish(run.runId, 'succeeded', 'Benchmark completed');
  const session = workspace.createQuerySession();
  const cache =
    'CREATE TABLE IF NOT EXISTS mosaic.preagg_abc AS SELECT count(*) AS n FROM load_data';
  await session.query(cache);
  assert.equal(
    (await session.query('SELECT n FROM mosaic.preagg_abc'))
      .getChild('n')
      .get(0),
    1000000n,
  );
  await remote.run('INSERT INTO load_data VALUES (1000001,1,1)');
  await workspace.refresh();
  await session.query('DROP SCHEMA IF EXISTS "mosaic" CASCADE');
  await session.query(cache);
  assert.equal(
    (await session.query('SELECT n FROM mosaic.preagg_abc'))
      .getChild('n')
      .get(0),
    1000001n,
  );
  await session.dispose();
  await remote.run('DISCONNECT');
  remote.closeSync();
  await workspace.exportBundle(join(root, 'load.roomie'));
  await importWorkspaceBundle(
    join(root, 'load.roomie'),
    join(root, 'restored'),
  );
  const restored = await openWorkspace({directory: join(root, 'restored')});
  try {
    assert.equal(
      (await restored.query('SELECT count(*) AS n FROM load_data'))
        .getChild('n')
        .get(0),
      1000001n,
    );
    assert.equal(
      (await restored.snapshot()).revisions[receipt.artifactId],
      101,
    );
  } finally {
    await restored.dispose();
  }
  console.log(
    JSON.stringify(
      {
        node: process.version,
        engine: workspace.engine,
        cpu: cpus()[0]?.model,
        rows: 1000000,
        iterationsPerScenario: 50,
        ...results,
        externalRefreshAndBundle: 'passed',
      },
      null,
      2,
    ),
  );
} finally {
  await client?.close();
  await server?.dispose();
  try {
    remote.closeSync();
  } catch {}
  native.closeSync();
  await workspace.dispose();
  await rm(root, {recursive: true, force: true});
}
