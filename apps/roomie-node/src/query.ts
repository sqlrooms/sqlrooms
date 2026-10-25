import {
  tableFromIPC,
  tableFromArrays,
  Type,
  type Table,
  type DataType,
} from 'apache-arrow';
import {type DuckDBResult, DuckDBBlobValue} from '@duckdb/node-api';
import {
  queryToArrowTable,
  type NodeDuckDbConnector,
} from '@sqlrooms/duckdb-node';
import {escapeVal, splitSqlStatements} from '@sqlrooms/duckdb-core';
import type {RoomState} from '../../roomie-cli-ui/src/RoomState';
import {assertLocalRenderQuery} from '../../roomie-cli-ui/src/renderQueryPolicy';

function unsupportedType(type: DataType): boolean {
  return (
    type.typeId === Type.Interval ||
    (type.children ?? []).some((field) => unsupportedType(field.type))
  );
}

/** Native limits apply before result decoding; wire framing stays compatible. */
export const QUERY_LIMITS = {
  concurrency: 4,
  pending: 64,
  sessions: 16,
  cacheTables: 32,
  rows: 100000,
  bytes: 32 * 1024 * 1024,
  deadlineMs: 30000,
} as const;

/** Bounded reads and connection-local, disposable Mosaic preaggregation sessions. */
export function createQueryService(
  connector: NodeDuckDbConnector,
  database: () => RoomState['db'],
) {
  let closing = false;
  let running = 0;
  const waiters: {resume: () => void; cancel: () => void}[] = [];
  const active = new Set<Promise<Table>>();
  const sessions = new Set<ReturnType<typeof session>>();
  function admit(work: () => Promise<Table>) {
    if (closing || active.size >= QUERY_LIMITS.pending)
      return Promise.reject(
        new Error('Query service unavailable or at capacity.'),
      );
    const result = work();
    active.add(result);
    void result.finally(() => active.delete(result)).catch(() => {});
    return result;
  }
  async function query(sql: string, signal?: AbortSignal) {
    return admit(async () => {
      const conn = await connector.getInstance().connect();
      try {
        return await execute(conn, sql, signal);
      } finally {
        conn.closeSync();
      }
    });
  }
  function session() {
    if (closing || sessions.size >= QUERY_LIMITS.sessions)
      throw new Error('Query session capacity reached.');
    const connection = connector.getInstance().connect();
    const cache = new Set<string>();
    type Job = {
      sql: string;
      signal?: AbortSignal;
      resolve: (value: Table) => void;
      reject: (error: unknown) => void;
      cancel: () => void;
    };
    const jobs: Job[] = [];
    let drain: Promise<void> | undefined;
    let closed = false;
    let disposal: Promise<void> | undefined;
    function pump() {
      if (drain) return;
      drain = (async () => {
        while (jobs.length) {
          const job = jobs.shift()!;
          job.signal?.removeEventListener('abort', job.cancel);
          try {
            job.resolve(
              await execute(await connection, job.sql, job.signal, cache),
            );
          } catch (error) {
            job.reject(error);
          }
        }
      })().finally(() => {
        drain = undefined;
        if (jobs.length) pump();
      });
    }
    const value = {
      query(sql: string, signal?: AbortSignal) {
        if (closed)
          return Promise.reject(
            new Error('Query session closed; rebuild the cache.'),
          );
        return admit(
          () =>
            new Promise<Table>((resolve, reject) => {
              const job: Job = {
                sql,
                signal,
                resolve,
                reject,
                cancel: () => {
                  const index = jobs.indexOf(job);
                  if (index >= 0) {
                    jobs.splice(index, 1);
                    reject(new Error('Query cancelled.'));
                  }
                },
              };
              if (signal?.aborted) {
                reject(new Error('Query cancelled.'));
                return;
              }
              signal?.addEventListener('abort', job.cancel, {once: true});
              jobs.push(job);
              pump();
            }),
        );
      },
      dispose() {
        if (disposal) return disposal;
        closed = true;
        disposal = (async () => {
          while (drain) await drain;
          (await connection).closeSync();
          sessions.delete(value);
        })();
        return disposal;
      },
    };
    sessions.add(value);
    return value;
  }
  async function execute(...args: Parameters<typeof executeNow>) {
    const signal = args[2];
    if (signal?.aborted) throw new Error('Query cancelled.');
    if (running >= QUERY_LIMITS.concurrency)
      await new Promise<void>((resolve, reject) => {
        const waiter = {
          resume: () => {
            signal?.removeEventListener('abort', waiter.cancel);
            resolve();
          },
          cancel: () => {
            const index = waiters.indexOf(waiter);
            if (index >= 0) {
              waiters.splice(index, 1);
              reject(new Error('Query cancelled.'));
            }
          },
        };
        waiters.push(waiter);
        signal?.addEventListener('abort', waiter.cancel, {once: true});
      });
    else running++;
    try {
      return await executeNow(...args);
    } finally {
      const next = waiters.shift();
      if (next) next.resume();
      else running--;
    }
  }
  async function executeNow(
    conn: Parameters<typeof queryToArrowTable>[0],
    sql: string,
    signal?: AbortSignal,
    cache?: Set<string>,
  ) {
    let expired = false;
    const check = () => {
      if (signal?.aborted || expired)
        throw new Error('Query cancelled or deadline exceeded.');
    };
    check();
    const abort = () => conn.interrupt();
    signal?.addEventListener('abort', abort, {once: true});
    const timer = setTimeout(() => {
      expired = true;
      abort();
    }, QUERY_LIMITS.deadlineMs);
    const raw = async (text: string) => {
      check();
      return queryToArrowTable(conn, text);
    };
    const db = {
      ...database(),
      getConnector: async () =>
        new Proxy(
          {...connector},
          {
            get: (target, key) =>
              key === 'query' ? raw : Reflect.get(target, key),
          },
        ),
      sqlSelectToJson: async (text: string) =>
        JSON.parse(
          (await raw(`SELECT json_serialize_sql(${escapeVal(text)})`))
            .getChildAt(0)!
            .get(0),
        ),
    };
    async function readSql(text: string) {
      if (cache) {
        const parsed = await db.sqlSelectToJson(text);
        let changed = false;
        const visit = (node: unknown) => {
          if (!node || typeof node !== 'object') return;
          const value = node as Record<string, unknown>;
          if (value.type === 'BASE_TABLE' && value.schema_name === 'mosaic') {
            const name = String(value.table_name);
            if (!cache!.has(name))
              throw new Error(
                'Mosaic cache missing; reconnect or refresh to rebuild.',
              );
            value.catalog_name = 'temp';
            value.schema_name = 'main';
            value.qualified_name = {path: ['temp', 'main', name]};
            changed = true;
          }
          for (const child of Object.values(value)) visit(child);
        };
        visit(parsed);
        if (changed)
          text = (
            await raw(
              `SELECT json_deserialize_sql(${escapeVal(JSON.stringify(parsed))})`,
            )
          )
            .getChildAt(0)!
            .get(0);
      }
      await assertLocalRenderQuery(db, text);
      return text;
    }
    try {
      const parts = splitSqlStatements(sql);
      if (!parts.length || parts.length > 2)
        throw new Error('Expected one read or Mosaic cache operation.');
      let result: Table = tableFromArrays({});
      for (const part of parts) {
        check();
        if (
          cache &&
          /^CREATE SCHEMA IF NOT EXISTS "?mosaic"?$/i.test(part.trim())
        )
          continue;
        if (
          cache &&
          /^DROP SCHEMA IF EXISTS "?mosaic"? CASCADE$/i.test(part.trim())
        ) {
          for (const name of cache)
            await conn.run(`DROP TABLE IF EXISTS temp.main."${name}"`);
          cache.clear();
          continue;
        }
        const create =
          cache &&
          /^CREATE TABLE IF NOT EXISTS mosaic\.(preagg_[a-f0-9]+) AS ([\s\S]+)$/i.exec(
            part.trim(),
          );
        if (create) {
          if (
            !cache!.has(create[1]!) &&
            cache!.size >= QUERY_LIMITS.cacheTables
          )
            throw new Error('Mosaic cache capacity reached; refresh.');
          const source = await readSql(create[2]!);
          await conn.run(
            `CREATE TEMP TABLE IF NOT EXISTS "${create[1]}" AS ${source}`,
          );
          cache!.add(create[1]!);
          continue;
        }
        if (parts.length > 1)
          throw new Error('Multiple reads are not supported.');
        const describe = /^\s*(?:DESCRIBE|DESC)\s+([\s\S]+)$/i.exec(part);
        const inspected = describe
          ? /^\s*(?:SELECT|WITH)\b/i.test(describe[1]!)
            ? describe[1]!
            : `SELECT * FROM ${describe[1]}`
          : part;
        const source = await readSql(inspected);
        if (describe) result = await raw(`DESCRIBE ${source}`);
        else {
          const bounded = `SELECT * FROM (${source}) AS roomie_result LIMIT ${QUERY_LIMITS.rows + 1}`;
          const stream = (await conn.stream(
            `SELECT * FROM to_arrow_ipc((${bounded}))`,
          )) as unknown as DuckDBResult; // The host bundles the pinned 2.0 API; shared connector declarations target 1.4.

          const buffers: Uint8Array[] = [];
          let bytes = 0;
          try {
            for await (const chunk of stream)
              for (const value of chunk.getColumnValues(0)) {
                check();
                if (!(value instanceof DuckDBBlobValue))
                  throw new Error('Invalid Arrow batch.');
                bytes += value.bytes.byteLength;
                if (bytes > QUERY_LIMITS.bytes)
                  throw new Error('Result exceeds 32 MiB; narrow the query.');
                buffers.push(value.bytes);
              }
          } finally {
            stream.closeSync();
          }
          result = buffers.length ? tableFromIPC(buffers) : await raw(bounded);
          if (result.schema.fields.some((field) => unsupportedType(field.type)))
            throw new Error(
              'INTERVAL results are not supported by Arrow JS 17; cast them to VARCHAR.',
            );
          if (result.numRows > QUERY_LIMITS.rows)
            throw new Error('Result exceeds 100000 rows; narrow the query.');
        }
      }
      check();
      return result;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  }
  return {
    query,
    session,
    async dispose() {
      closing = true;
      await Promise.allSettled([...active]);
      await Promise.all([...sessions].map((value) => value.dispose()));
    },
  };
}
