import {
  createWasmDuckDbConnector,
  createWebSocketDuckDbConnector,
  type DuckDbConnector,
} from '@sqlrooms/duckdb';
import type {DuckDBBundles, DuckDBConfig} from '@sqlrooms/duckdb';

/**
 * Event persisted to `${schema}.crdt_events`.
 */
export interface CrdtEventRow {
  docId: string;
  userId?: string;
  createdAt?: Date; // server uses CURRENT_TIMESTAMP if omitted
  updateData: Uint8Array;
}

/**
 * Options for creating a SyncDuckDbConnector.
 */
export interface SyncDuckDbConnectorOptions extends DuckDBConfig {
  /**
   * Schema name for CRDT tables. Defaults to `crdt`.
   */
  schema?: string;
  /** @deprecated use `path` instead */
  dbPath?: string;
  initializationQuery?: string;
  logging?: boolean;
  bundles?: DuckDBBundles;
}

/**
 * DuckDB Wasm connector extended with CRDT sync helpers (events & snapshots).
 *
 * This composes the base `WasmDuckDbConnector` to avoid duplication.
 */
export interface SyncDuckDbConnector extends DuckDbConnector {
  /** Default schema used for CRDT tables */
  readonly crdtSchema: string;

  /** Ensure `${schema}` and required CRDT tables/sequences exist. */
  ensureSchema(schema?: string): Promise<void>;

  /**
   * Insert CRDT update events into `${schema}.crdt_events`.
   */
  insertEvents(events: CrdtEventRow[], schema?: string): Promise<void>;

  /**
   * Insert a snapshot row into `${schema}.crdt_snapshots`.
   */
  insertSnapshot(
    docId: string,
    data: Uint8Array,
    createdBy?: string,
    schema?: string,
  ): Promise<void>;

  /**
   * Read the latest snapshot bytes for a document (or null if none).
   */
  readLatestSnapshot(
    docId: string,
    schema?: string,
  ): Promise<{data: Uint8Array; createdAt?: string} | null>;

  /**
   * Read all event update bytes for a document ordered by `event_id`,
   * optionally only those created after `since` (timestamp string).
   */
  readEventsSince(
    docId: string,
    since?: string | null,
    schema?: string,
  ): Promise<Uint8Array[]>;
  /** Minimal CRDT helpers for WS messaging (no-op on non-WS connectors) */
  readonly crdt: {
    init: (docId: string, branch?: string) => void;
    sendUpdate: (docId: string, update: Uint8Array, branch?: string) => void;
  };
  /** Internal: attach an extra notification listener (forwarded if supported) */
  __addNotificationListener?: (fn: (payload: any) => void) => void;
}

export function u8ToHex(u8: Uint8Array): string {
  return Array.from(u8)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToU8(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const arr = new Uint8Array(clean.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return arr;
}

/**
 * Create a `SyncDuckDbConnector` by composing a `WasmDuckDbConnector` with
 * CRDT sync helpers (schema management, events, snapshots).
 */
export function createSyncDuckDbConnector(
  options: SyncDuckDbConnectorOptions = {},
): SyncDuckDbConnector {
  const {schema: defaultSchema = 'crdt', ...rest} = options as any;
  const isWs =
    typeof (rest as any).wsUrl === 'string' || (rest as any).type === 'ws';
  const base: DuckDbConnector = isWs
    ? (createWebSocketDuckDbConnector(
        rest as any,
      ) as unknown as DuckDbConnector)
    : (createWasmDuckDbConnector(rest as any) as unknown as DuckDbConnector);

  return {
    ...base,
    get crdtSchema() {
      return defaultSchema;
    },

    async ensureSchema(schema?: string) {
      const s = schema ?? defaultSchema;
      const sql = `
        CREATE SCHEMA IF NOT EXISTS ${s};
        CREATE TABLE IF NOT EXISTS ${s}.crdt_meta (
          doc_id TEXT PRIMARY KEY,
          title TEXT,
          created_at TIMESTAMP,
          last_saved TIMESTAMP
        );
        CREATE SEQUENCE IF NOT EXISTS ${s}.crdt_events_seq;
        CREATE TABLE IF NOT EXISTS ${s}.crdt_events (
          event_id BIGINT PRIMARY KEY DEFAULT nextval('${s}.crdt_events_seq'),
          doc_id TEXT,
          created_at TIMESTAMP,
          user_id TEXT,
          update_data BLOB
        );
        CREATE TABLE IF NOT EXISTS ${s}.crdt_snapshots (
          snapshot_id UUID PRIMARY KEY,
          doc_id TEXT,
          created_at TIMESTAMP,
          created_by TEXT,
          data BLOB
        );
      `;
      await base.query(sql).result;
    },

    async insertEvents(events: CrdtEventRow[], schema?: string) {
      if (!events || events.length === 0) return;
      const s = schema ?? defaultSchema;
      const values = events
        .map((e) => {
          const user = e.userId ? `'${e.userId}'` : 'NULL';
          const hex = u8ToHex(e.updateData);
          return `('${e.docId}', CURRENT_TIMESTAMP, ${user}, from_hex('${hex}'))`;
        })
        .join(',');
      const sql = `INSERT INTO ${s}.crdt_events (doc_id, created_at, user_id, update_data) VALUES ${values}`;
      await base.query(sql).result;
    },

    async insertSnapshot(
      docId: string,
      data: Uint8Array,
      createdBy?: string,
      schema?: string,
    ) {
      const s = schema ?? defaultSchema;
      const hex = u8ToHex(data);
      const createdBySql = createdBy ? `'${createdBy}'` : 'NULL';
      const sql = `INSERT INTO ${s}.crdt_snapshots (snapshot_id, doc_id, created_at, created_by, data)
        VALUES (gen_random_uuid(), '${docId}', CURRENT_TIMESTAMP, ${createdBySql}, from_hex('${hex}'))`;
      await base.query(sql).result;
    },

    async readLatestSnapshot(docId: string, schema?: string) {
      const s = schema ?? defaultSchema;
      const sql = `SELECT to_hex(data) AS hex, created_at FROM ${s}.crdt_snapshots WHERE doc_id='${docId}' ORDER BY created_at DESC LIMIT 1`;
      const rows = await base.queryJson<{hex?: string; created_at?: string}>(
        sql,
      ).result;
      for (const row of rows) {
        if (row?.hex) {
          return {data: hexToU8(String(row.hex)), createdAt: row.created_at};
        }
      }
      return null;
    },

    async readEventsSince(
      docId: string,
      since?: string | null,
      schema?: string,
    ) {
      const s = schema ?? defaultSchema;
      const whereSince = since ? `AND created_at > TIMESTAMP '${since}'` : '';
      const sql = `SELECT to_hex(update_data) AS hex FROM ${s}.crdt_events WHERE doc_id='${docId}' ${whereSince} ORDER BY event_id`;
      const rows = await base.queryJson<{hex?: string}>(sql).result;
      const out: Uint8Array[] = [];
      for (const row of rows) {
        if (row?.hex) out.push(hexToU8(String(row.hex)));
      }
      return out;
    },

    crdt: {
      init: (docId: string, branch?: string) => {
        (base as any).sendControlMessage?.({
          type: 'crdtInit',
          docId,
          branch: branch ?? 'main',
        });
      },
      sendUpdate: (docId: string, update: Uint8Array, branch?: string) => {
        const b64 = btoa(String.fromCharCode(...update));
        (base as any).sendControlMessage?.({
          type: 'crdtUpdate',
          docId,
          branch: branch ?? 'main',
          data: b64,
        });
      },
    },

    __addNotificationListener: (fn: (payload: any) => void) => {
      (base as any).__addNotificationListener?.(fn);
    },
  };
}
