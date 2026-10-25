import {createHash} from 'node:crypto';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {z} from 'zod';
import {escapeVal} from '@sqlrooms/duckdb-core';
import type {NodeDuckDbConnector} from '@sqlrooms/duckdb-node';
import type {MetadataStore} from './metadata';

const Upload = z.strictObject({
  operationId: z.string().min(1).max(200),
  tableName: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,127}$/),
  format: z.enum(['arrow', 'csv', 'json', 'parquet']),
});
/** Host-managed import; callers provide bytes, never filesystem paths or SQL. */
export type WorkspaceUpload = z.infer<typeof Upload>;
/** Bounded imports with an analytical receipt in the same transaction as the table. */
export function createUploads(
  connector: NodeDuckDbConnector,
  metadata: MetadataStore,
  refresh: () => Promise<unknown>,
  exchangeDirectory: string,
) {
  let queue = Promise.resolve();
  let pending = 0;
  async function initialize() {
    await connector.execute(
      'CREATE SCHEMA IF NOT EXISTS __roomie; CREATE TABLE IF NOT EXISTS __roomie.data_operations(operation_id VARCHAR PRIMARY KEY, request_hash VARCHAR NOT NULL, table_name VARCHAR NOT NULL)',
    );
    for (const effect of metadata.dataEffects.pending()) {
      const rows = await connector.queryJson<{request_hash: string}>(
        `SELECT request_hash FROM __roomie.data_operations WHERE operation_id=${escapeVal(effect.operationId)}`,
      );
      const row = [...rows][0];
      metadata.dataEffects.finish(
        effect.operationId,
        row?.request_hash === effect.requestHash ? 'committed' : 'interrupted',
      );
    }
  }
  function upload(raw: WorkspaceUpload, bytes: Uint8Array) {
    const input = Upload.parse(raw);
    if (!bytes.byteLength || bytes.byteLength > 32 * 1024 * 1024)
      throw new Error('Upload must contain 1 byte to 32 MiB.');
    if (pending >= 2) throw new Error('Upload capacity reached.');
    // Own bytes before asynchronous work; callers cannot alter admitted input.
    const payload = Uint8Array.from(bytes);
    const hash = createHash('sha256')
      .update(JSON.stringify(input))
      .update(payload)
      .digest('hex');
    pending++;
    const task = queue.then(async () => {
      metadata.dataEffects.begin(input.operationId, hash);
      const connection = await connector.getInstance().connect();
      let directory = '';
      const deadline = setTimeout(() => connection.interrupt(), 30000);
      try {
        directory = await mkdtemp(join(exchangeDirectory, 'upload-'));
        const prior = (
          await connection.runAndReadAll(
            `SELECT request_hash, table_name FROM __roomie.data_operations WHERE operation_id=${escapeVal(input.operationId)}`,
          )
        ).getRowObjectsJson()[0];
        if (prior) {
          if (prior.request_hash !== hash)
            throw new Error(
              'Operation ID was already used with different input.',
            );
          metadata.dataEffects.finish(input.operationId, 'committed');
          return {
            operationId: input.operationId,
            tableName: String(prior.table_name),
          };
        }
        const path = join(directory, `input.${input.format}`);
        await writeFile(path, payload, {mode: 0o600});
        const source =
          input.format === 'csv'
            ? `read_csv_auto(${escapeVal(path)})`
            : input.format === 'json'
              ? `read_json_auto(${escapeVal(path)})`
              : escapeVal(path);
        await connection.run('BEGIN TRANSACTION');
        try {
          // Creation deliberately refuses to replace an existing user table.
          await connection.run(
            `CREATE TABLE main."${input.tableName}" AS SELECT * FROM ${source}`,
          );
          await connection.run(
            `INSERT INTO __roomie.data_operations VALUES (${escapeVal(input.operationId)},${escapeVal(hash)},${escapeVal(input.tableName)})`,
          );
          await connection.run('COMMIT');
        } catch (error) {
          await connection.run('ROLLBACK').catch(() => {});
          throw error;
        }
        metadata.dataEffects.finish(input.operationId, 'committed');
        await refresh();
        return {operationId: input.operationId, tableName: input.tableName};
      } finally {
        clearTimeout(deadline);
        connection.closeSync();
        if (directory) await rm(directory, {recursive: true, force: true});
      }
    });
    queue = task.then(
      () => {},
      () => {},
    );
    void task.finally(() => pending--).catch(() => {});
    return task;
  }
  return {initialize, upload, flush: () => queue};
}
