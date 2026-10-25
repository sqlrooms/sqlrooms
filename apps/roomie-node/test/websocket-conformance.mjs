import {WebSocket} from 'ws';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {tableFromIPC} from 'apache-arrow';
const fixture = JSON.parse(
  await readFile(
    new URL('../../../tests/protocol/sql-arrow.json', import.meta.url),
    'utf8',
  ),
);
export async function socketClient(url, token, path = '/ws') {
  const ws = new WebSocket(
    url.replace('http:', 'ws:') +
      path +
      '?roomId=workspace&clientId=conformance',
  );
  const messages = [];
  const waiters = [];
  ws.on('message', (data, binary) => {
    const value = binary ? data : JSON.parse(data.toString());
    const waiter = waiters.shift();
    if (waiter) waiter(value);
    else messages.push(value);
  });
  await once(ws, 'open');
  const next = () =>
    messages.length
      ? Promise.resolve(messages.shift())
      : new Promise((resolve) => waiters.push(resolve));
  ws.send(JSON.stringify({type: 'auth', token}));
  assert.equal((await next()).type, 'authAck');
  return {
    ws,
    next,
    send: (value) => ws.send(JSON.stringify(value)),
    async close() {
      const closed = once(ws, 'close');
      ws.close();
      await closed;
    },
  };
}
export async function exerciseWebSocket(t, kind, url, token) {
  const client = await socketClient(
    url,
    token,
    kind === 'python' ? '/ws/duckdb' : '/ws',
  );
  try {
    for (const item of fixture.cases)
      await t.test(`SQL/Arrow ${item.name}`, async () => {
        client.send({type: 'arrow', sql: item.sql, queryId: item.name});
        const frame = await client.next();
        assert.ok(Buffer.isBuffer(frame), JSON.stringify(frame));
        const size = frame.readUInt32BE(0);
        const header = JSON.parse(frame.subarray(4, 4 + size));
        assert.equal(header.queryId, item.name);
        const table = tableFromIPC(frame.subarray(4 + size));
        assert.equal(table.numRows, item.rows);
        assert.deepEqual(
          table.schema.fields.map((field) => field.name),
          item.columns,
        );
        if (item.name === 'integer and null') {
          assert.equal(table.getChild('n').get(0), 42);
          assert.equal(table.getChild('empty').get(0), null);
        }
        if (item.name === 'nested physical data')
          assert.deepEqual(Array.from(table.getChild('nested').get(0)), [1, 2]);
        if (item.name === 'representative native types') {
          assert.equal(table.getChild('big').get(0), 9007199254740993n);
          assert.equal(table.getChild('amount').type.scale, 2);
          assert.equal(table.getChild('amount').get(0)[0], 1234);
        }
        if (item.name === 'precise and temporal types') {
          assert.equal(
            table.getChild('unsigned').get(0),
            18446744073709551615n,
          );
          const precise = table.getChild('precise');
          assert.equal(precise.type.scale, 9);
          assert.equal(precise.type.precision, 38);
          const words = precise.get(0);
          assert.equal(
            Array.from(words).reduceRight(
              (n, word) => (n << 32n) + BigInt(word),
              0n,
            ),
            12345678901234567890123456789n,
          );
          assert.equal(table.getChild('date').get(0), Date.UTC(2024, 1, 29));
          assert.equal(
            table.getChild('nanos').data[0].values[0],
            1767229323123456789n,
          );
          assert.deepEqual(
            Array.from(table.getChild('bytes').get(0)),
            [0, 255],
          );
          assert.equal(
            table.getChild('duration').get(0),
            '2 months 3 days 00:00:00.000004',
          );
        }
        if (item.name === 'date histogram interval') {
          assert.equal(table.getChild('x1').get(0), Date.UTC(2026, 0, 5));
          assert.equal(table.getChild('x2').get(0), Date.UTC(2026, 0, 6));
        }
      });
    await t.test('SQL error preserves request ID', async () => {
      client.send({
        type: 'arrow',
        sql: 'SELECT * FROM missing_conformance_table',
        queryId: 'bad',
      });
      const result = await client.next();
      assert.equal(result.type, 'error');
      assert.equal(result.queryId, 'bad');
    });
    await t.test('cancellation preserves unrelated queries', async () => {
      client.send({
        type: 'arrow',
        sql: 'SELECT SUM(sqrt(a.i)) FROM conformance_numbers a, conformance_numbers b, conformance_numbers c',
        queryId: 'slow',
      });
      client.send({
        type: 'arrow',
        sql: 'SELECT 42::INTEGER AS value',
        queryId: 'independent',
      });
      await new Promise((resolve) => setTimeout(resolve, 30));
      client.send({type: 'cancel', queryId: 'slow'});
      const results = [];
      while (results.length < 2) {
        const value = await client.next();
        if (Buffer.isBuffer(value) || value.type === 'error')
          results.push(value);
      }
      const error = results.find((value) => !Buffer.isBuffer(value));
      assert.equal(error.queryId, 'slow');
      assert.match(error.error, /cancel|interrupt/i);
      const binary = results.find(Buffer.isBuffer);
      const size = binary.readUInt32BE(0);
      assert.equal(
        JSON.parse(binary.subarray(4, 4 + size)).queryId,
        'independent',
      );
      assert.equal(
        tableFromIPC(binary.subarray(4 + size))
          .getChild('value')
          .get(0),
        42,
      );
    });
    await t.test(
      'CRDT join provides a binary-compatible snapshot',
      async () => {
        client.send({
          type: 'crdt-join',
          roomId: 'workspace',
          clientId: 'conformance',
        });
        assert.equal((await client.next()).type, 'crdt-joined');
        const snapshot = await client.next();
        assert.equal(snapshot.type, 'crdt-snapshot');
        assert.ok(Buffer.from(snapshot.data, 'base64').length > 0);
      },
    );
    if (kind === 'node' && !fixture.capabilities[kind].snapshotSeeding)
      await t.test(
        'host-owned content rejects seeding and raw updates',
        async () => {
          client.send({
            type: 'crdt-snapshot',
            roomId: 'workspace',
            data: 'AA==',
          });
          assert.equal((await client.next()).code, 'document_read_only');
          client.ws.send(Buffer.from([0]));
          assert.equal((await client.next()).code, 'document_read_only');
          client.send({type: 'crdt-join', roomId: 'other'});
          assert.equal((await client.next()).code, 'room_not_found');
        },
      );
  } finally {
    await client.close();
  }
}
