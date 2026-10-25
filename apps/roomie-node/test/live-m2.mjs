// Opt-in live acceptance driver; run from apps/roomie-node with authenticated Codex 0.163.0.
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {DuckDBInstance} from '@duckdb/node-api';
import {openWorkspace, startWorkspaceServer} from '../dist/index.mjs';
const directory = resolve(
  process.env.ROOMIE_M2_DIRECTORY ?? '/private/tmp/roomie-m2-acceptance',
);
await mkdir(directory, {recursive: true});
if (process.argv.includes('--seed')) {
  const db = await DuckDBInstance.create(join(directory, 'data.duckdb'));
  const conn = await db.connect();
  await conn.run(`CREATE TABLE orders(order_id INTEGER, ordered_at DATE, amount DECIMAL(10,2), status VARCHAR);
 INSERT INTO orders VALUES (1,'2026-01-05',100,'paid'),(2,'2026-01-20',200,'paid'),(3,'2026-01-25',50,'paid'),(4,'2026-02-02',400,'paid'),(5,'2026-02-10',50,'paid'),(6,'2026-02-14',900,'cancelled');
 CREATE TABLE payments(order_id INTEGER, attempt INTEGER, amount DECIMAL(10,2), status VARCHAR);
 INSERT INTO payments VALUES (1,1,100,'failed'),(1,2,100,'paid'),(2,1,200,'paid'),(3,1,50,'paid'),(4,1,400,'failed'),(4,2,400,'paid'),(5,1,50,'paid');
 CREATE TABLE refunds(order_id INTEGER, amount DECIMAL(10,2)); INSERT INTO refunds VALUES(3,50);
 CREATE TABLE recognized_revenue AS SELECT o.order_id, o.ordered_at, o.amount FROM orders o WHERE o.status='paid' AND NOT EXISTS(SELECT 1 FROM refunds r WHERE r.order_id=o.order_id);`);
  conn.closeSync();
  db.closeSync();
}
const workspace = await openWorkspace({directory});
if (process.argv.includes('--seed'))
  await workspace.mutate({
    operationId: 'knowledge-create',
    principalId: 'owner',
    commandId: 'block-document.create',
    input: {
      title: 'Workspace knowledge — Revenue',
      blocks: [
        {
          id: 'definition',
          type: 'paragraph',
          text: 'Revenue is the sum of paid, non-refunded orders at one row per order_id, grouped by ordered_at month. Exclude any order appearing in refunds entirely. Cancelled orders do not count. Payments is one row per attempt and includes retries: do not sum it or join it in a way that duplicates orders. The recognized_revenue materialized table implements the approved definition and is the intended chart source. Verify the equivalent definition SQL against orders/refunds and monthly values before authoring a report.',
        },
      ],
    },
  });
const server = await startWorkspaceServer({
  workspace,
  port: Number(process.env.ROOMIE_M2_PORT ?? 0),
  uiDirectory: resolve('../roomie-cli-ui/dist'),
  harness: {trustedLocal: true, deadlineMs: 300000},
});
await writeFile(
  join(directory, 'control.json'),
  JSON.stringify({url: server.url, credentialPath: server.credentialPath}),
  {mode: 0o600},
);
console.log(JSON.stringify({url: server.url, directory}));
let last = 0;
const interval = setInterval(() => {
  for (const event of workspace.runs.events(last)) {
    last = event.seq;
    console.log(
      JSON.stringify({
        seq: event.seq,
        kind: event.kind,
        status: event.payload.status,
      }),
    );
  }
}, 1000);
async function stop() {
  clearInterval(interval);
  await server.dispose();
  await workspace.dispose();
  process.exit();
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
