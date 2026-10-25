import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {tableToIPC, tableFromArrays} from 'apache-arrow';
import {DuckDBInstance} from '@duckdb/node-api';
import {openWorkspace, startWorkspaceServer} from '../dist/index.mjs';
import {socketClient} from './websocket-conformance.mjs';

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'roomie-m3-query-'));
  const workspace = await openWorkspace({directory});
  t.after(async () => {
    await workspace.dispose();
    await rm(directory, {recursive: true, force: true});
  });
  return {workspace, directory};
}
test('CSV, JSON, Arrow and Parquet imports persist, retry once and cannot overwrite tables or internal state', async (t) => {
  const {workspace, directory} = await fixture(t);
  const native = await DuckDBInstance.create(':memory:');
  const connection = await native.connect();
  const parquet = join(directory, 'source.parquet');
  try {
    await connection.run(
      `COPY (SELECT 9007199254740993::BIGINT AS id, 12.34::DECIMAL(10,2) AS amount) TO '${parquet}' (FORMAT PARQUET)`,
    );
  } finally {
    connection.closeSync();
    native.closeSync();
  }
  for (const [format, bytes] of [
    ['csv', Buffer.from('id,amount\n1,2.5\n2,3.5\n')],
    ['json', Buffer.from('[{"id":1,"amount":2.5},{"id":2,"amount":3.5}]')],
    [
      'arrow',
      tableToIPC(
        tableFromArrays({
          id: new BigInt64Array([9007199254740993n]),
          amount: new Float64Array([12.34]),
        }),
        'stream',
      ),
    ],
    ['parquet', await readFile(parquet)],
  ]) {
    const input = {operationId: format, tableName: 'data_' + format, format};
    const first = await workspace.upload(input, bytes);
    assert.deepEqual(await workspace.upload(input, bytes), first);
    const rows = await workspace.query(`SELECT * FROM data_${format}`);
    assert.ok(rows.numRows);
    if (format === 'arrow' || format === 'parquet')
      assert.equal(rows.getChild('id').get(0), 9007199254740993n);
    await assert.rejects(
      workspace.upload({...input, operationId: format + '-overwrite'}, bytes),
      /already exists/,
    );
    await assert.rejects(
      workspace.upload(input, Buffer.from('different')),
      /different input/,
    );
  }
  assert.throws(
    () =>
      workspace.upload(
        {operationId: 'bad', tableName: '__roomie', format: 'csv'},
        Buffer.from('a\n1'),
      ),
    /pattern|Invalid/,
  );
  await workspace.dispose();
  const reopened = await openWorkspace({directory});
  try {
    assert.equal((await reopened.query('SELECT * FROM data_csv')).numRows, 2);
  } finally {
    await reopened.dispose();
  }
});
test('Mosaic sessions isolate temporary caches, rebuild after disconnect, and reject unrestricted writes', async (t) => {
  const {workspace} = await fixture(t);
  await workspace.upload(
    {operationId: 'data', tableName: 'sales', format: 'csv'},
    Buffer.from('amount\n100\n200\n300\n'),
  );
  const a = workspace.createQuerySession(),
    b = workspace.createQuerySession();
  const create =
    'CREATE SCHEMA IF NOT EXISTS mosaic; CREATE TABLE IF NOT EXISTS mosaic.preagg_abc AS SELECT floor(amount / 100) * 100 AS bin, count(*) AS count FROM sales GROUP BY 1';
  await a.query(create);
  assert.equal((await a.query('SELECT * FROM mosaic.preagg_abc')).numRows, 3);
  await assert.rejects(
    b.query('SELECT * FROM mosaic.preagg_abc'),
    /cache missing/,
  );
  for (const sql of [
    'CREATE TABLE main.evil AS SELECT 1',
    "CREATE TABLE IF NOT EXISTS mosaic.preagg_bad AS SELECT * FROM read_csv('/etc/passwd')",
    'DROP SCHEMA main CASCADE',
    'SELECT * FROM __roomie.data_operations',
    'SELECT 1; DROP TABLE sales',
  ])
    await assert.rejects(a.query(sql));
  await a.query('DROP SCHEMA IF EXISTS "mosaic" CASCADE');
  await a.query(create);
  await a.dispose();
  await b.dispose();
  const c = workspace.createQuerySession();
  await assert.rejects(
    c.query('SELECT * FROM mosaic.preagg_abc'),
    /cache missing/,
  );
  await c.query(create);
  await c.dispose();
});
test('binary Arrow uploads use existing framing and SQL errors preserve IDs', async (t) => {
  const {workspace} = await fixture(t);
  const server = await startWorkspaceServer({workspace});

  const {token} = JSON.parse(await readFile(server.credentialPath, 'utf8'));
  const client = await socketClient(server.url, token);
  const header = Buffer.from(
    JSON.stringify({
      type: 'uploadArrow',
      queryId: 'upload-one',
      tableName: 'wire',
    }),
  );
  const prefix = Buffer.alloc(4);
  prefix.writeUInt32BE(header.length);
  client.ws.send(
    Buffer.concat([
      prefix,
      header,
      tableToIPC(tableFromArrays({n: [1, 2, 3]}), 'stream'),
    ]),
  );
  assert.deepEqual(await client.next(), {
    type: 'uploadAck',
    queryId: 'upload-one',
  });
  client.send({
    type: 'json',
    queryId: 'json',
    sql: 'SELECT n FROM wire ORDER BY n',
  });
  assert.deepEqual(await client.next(), {
    type: 'json',
    queryId: 'json',
    data: [{n: 1}, {n: 2}, {n: 3}],
  });
  await client.close();
  await server.dispose();
});

test('cancelled queued requests release capacity without interrupting their predecessor', async (t) => {
  const {workspace} = await fixture(t);
  await workspace.upload(
    {operationId: 'numbers', tableName: 'numbers', format: 'csv'},
    Buffer.from('i\n' + Array.from({length: 1000}, (_, i) => i).join('\n')),
  );
  const session = workspace.createQuerySession();
  const slow = new AbortController();
  const running = session
    .query(
      'SELECT sum(sqrt(a.i)) FROM numbers a, numbers b, numbers c',
      slow.signal,
    )
    .catch((e) => e);
  await new Promise((r) => setTimeout(r, 20));
  for (let i = 0; i < 80; i++) {
    const cancel = new AbortController();
    const queued = session.query('SELECT 1', cancel.signal);
    cancel.abort();
    await assert.rejects(
      Promise.race([
        queued,
        new Promise((_, reject) => {
          const timeout = setTimeout(
            () => reject(new Error('cancel did not settle')),
            200,
          );
          timeout.unref();
        }),
      ]),
      /cancelled/,
    );
  }
  slow.abort();
  assert.match((await running).message, /cancel|interrupt/i);
  assert.equal(
    (await session.query('SELECT 42 AS n')).getChild('n').get(0),
    42,
  );
  await session.dispose();
});
test('result and session limits fail explicitly and uploads remain recoverable', async (t) => {
  const {workspace} = await fixture(t);
  await assert.rejects(
    workspace.query("SELECT INTERVAL '2 months 3 days' AS duration"),
    /cast them to VARCHAR/,
  );
  const sessions = Array.from({length: 16}, () =>
    workspace.createQuerySession(),
  );
  assert.throws(() => workspace.createQuerySession(), /capacity/);
  await Promise.all(sessions.map((s) => s.dispose()));
  await workspace.upload(
    {operationId: 'rows', tableName: 'rows', format: 'csv'},
    Buffer.from('i\n' + Array.from({length: 100001}, (_, i) => i).join('\n')),
  );
  await assert.rejects(workspace.query('SELECT * FROM rows'), /100000/);
  assert.equal(
    (await workspace.query('SELECT count(*) AS n FROM rows'))
      .getChild('n')
      .get(0),
    100001n,
  );
});

test('native upload commit survives a failed metadata acknowledgement and retry after restart', async (t) => {
  const {openMetadata} = await import('../dist/index.mjs');
  const directory = await mkdtemp(join(tmpdir(), 'roomie-upload-recovery-'));
  let fail = true;
  let workspace = await openWorkspace({
    directory,
    openMetadata: (path) => {
      const metadata = openMetadata(path);
      return {
        ...metadata,
        dataEffects: {
          ...metadata.dataEffects,
          finish: (...args) => {
            if (fail) {
              fail = false;
              throw new Error('lost metadata acknowledgement');
            }
            return metadata.dataEffects.finish(...args);
          },
        },
      };
    },
  });
  t.after(async () => {
    await workspace.dispose();
    await rm(directory, {recursive: true, force: true});
  });
  const input = {operationId: 'recover', tableName: 'recovered', format: 'csv'},
    bytes = Buffer.from('n\n1\n2');
  await assert.rejects(workspace.upload(input, bytes), /lost metadata/);
  await workspace.dispose();
  workspace = await openWorkspace({directory});
  assert.deepEqual(await workspace.upload(input, bytes), {
    operationId: 'recover',
    tableName: 'recovered',
  });
  assert.equal(
    (await workspace.query('SELECT count(*) AS n FROM recovered'))
      .getChild('n')
      .get(0),
    2n,
  );
  await assert.rejects(
    workspace.upload({...input, operationId: 'rolled-back'}, bytes),
    /already exists/,
  );
  await workspace.dispose();
  workspace = await openWorkspace({directory});
  assert.equal(
    (await workspace.query('SELECT count(*) AS n FROM recovered'))
      .getChild('n')
      .get(0),
    2n,
  );
});
test('oversized Arrow results fail before decoding and the next query still works', async (t) => {
  const {workspace} = await fixture(t);
  await workspace.upload(
    {operationId: 'wide', tableName: 'wide', format: 'arrow'},
    tableToIPC(
      tableFromArrays({value: ['x'.repeat(17 * 1024 * 1024)]}),
      'stream',
    ),
  );
  await assert.rejects(
    workspace.query('SELECT concat(value,value) AS value FROM wide'),
    /32 MiB/,
  );
  assert.equal(
    (await workspace.query('SELECT 1 AS n')).getChild('n').get(0),
    1,
  );
});

test('session disposal drains work admitted while the previous drain is settling', async (t) => {
  const {workspace} = await fixture(t);
  for (let i = 0; i < 10; i++) {
    const session = workspace.createQuerySession();
    await session.query('SELECT 1');
    const pending = session.query('SELECT 2 AS n');
    const disposing = session.dispose();
    assert.equal(session.dispose(), disposing);
    await disposing;
    assert.equal((await pending).getChild('n').get(0), 2);
  }
});

test('Unicode CTE aliases cannot conceal a physical view from render policy', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'roomie-cte-identifiers-'));
  const native = await DuckDBInstance.create(join(directory, 'data.duckdb'));
  const c = await native.connect();
  await c.run(
    'CREATE VIEW k AS SELECT 42 AS n; CREATE MACRO "LOWER"(x) AS \'macro shadow\'',
  );
  c.closeSync();
  native.closeSync();
  const workspace = await openWorkspace({directory});
  t.after(async () => {
    await workspace.dispose();
    await rm(directory, {recursive: true, force: true});
  });
  await assert.rejects(workspace.query('SELECT * FROM k'), /ordinary local/);
  await assert.rejects(
    workspace.query("SELECT lower('input') AS n"),
    /ordinary local/,
  );
  await assert.rejects(
    workspace.query('WITH "K" AS (SELECT 1 AS n) SELECT * FROM k'),
    /ordinary local/,
  );
  assert.equal(
    (
      await workspace.query(
        'WITH "COUNTS" AS (SELECT 1 AS n) SELECT * FROM counts',
      )
    )
      .getChild('n')
      .get(0),
    1,
  );
});
