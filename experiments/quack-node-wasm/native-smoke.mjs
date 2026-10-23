import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {DuckDBInstance} from '@duckdb/node-api';

const extensionDirectory = fileURLToPath(
  new URL('.runtime/extensions', import.meta.url),
);
await mkdir(extensionDirectory, {recursive: true});
const server = await DuckDBInstance.create(':memory:', {
  extension_directory: extensionDirectory,
});
const client = await DuckDBInstance.create(':memory:', {
  extension_directory: extensionDirectory,
});
const serverConnection = await server.connect();
const clientConnection = await client.connect();
const uri = 'quack:127.0.0.1:19495';
const token = randomBytes(24).toString('hex');
let listening = false;
try {
  await serverConnection.run(`INSTALL quack; LOAD quack;
    CREATE TABLE sales AS SELECT i::INTEGER AS id,
    (20 + (i * 37) % 180)::DOUBLE AS amount FROM range(120) t(i)`);
  await serverConnection.run(`CALL quack_serve('${uri}', token='${token}')`);
  listening = true;
  await clientConnection.run('LOAD quack');
  await assert.rejects(
    clientConnection.run(`ATTACH '${uri}' AS denied (TOKEN 'wrong-token')`),
    /auth|401|403|token/i,
  );
  await clientConnection.run(
    `ATTACH '${uri}' AS remote_db (TOKEN '${token}'); CONNECT remote_db`,
  );
  const result = (
    await clientConnection.runAndReadAll(`SELECT version() AS version,
    count(*)::INTEGER AS rows, sum(amount)::DOUBLE AS total FROM sales`)
  ).getRowObjectsJson();
  assert.equal(result[0].version, 'v2.0.0');
  assert.equal(result[0].rows, 120);
  assert.equal(
    result[0].total,
    Array.from({length: 120}, (_, i) => 20 + ((i * 37) % 180)).reduce(
      (a, b) => a + b,
      0,
    ),
  );
  console.log(
    JSON.stringify(
      {
        status: 'PASS',
        transport:
          'Native Node client → HTTP Quack → separate Node-owned DuckDB instance',
        unauthorizedRejected: true,
        result,
      },
      null,
      2,
    ),
  );
} finally {
  clientConnection.closeSync();
  client.closeSync();
  if (listening) await serverConnection.run(`CALL quack_stop('${uri}')`);
  serverConnection.closeSync();
  server.closeSync();
}
