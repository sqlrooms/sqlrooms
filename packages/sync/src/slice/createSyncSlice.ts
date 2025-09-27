import {CrdtSliceState, createCrdtSlice} from '@sqlrooms/crdt';
import {isControlMessagesConnector} from '@sqlrooms/duckdb';
import {BaseRoomConfig, createSlice} from '@sqlrooms/room-shell';
import {StoreApi} from 'zustand';
const u8ToHex = (u8: Uint8Array): string =>
  Array.from(u8)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
const hexToU8 = (hex: string): Uint8Array => {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const arr = new Uint8Array(clean.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return arr;
};

export type SyncSliceState = CrdtSliceState & {
  sync: {
    schema: string;
    /** Ensure schema/tables exist */
    ensureSchema: () => Promise<void>;
    /** Apply local Loro update and buffer for persistence */
    applyLocalUpdate: (
      key: string,
      update: Uint8Array,
      userId?: string,
    ) => void;
    /** Force flush buffered updates */
    flush: () => Promise<void>;
    /** Create a snapshot of a given doc */
    snapshot: (key: string, docId: string, createdBy?: string) => Promise<void>;
    /** Recover a doc by loading latest snapshot + subsequent events */
    recover: (key: string, docId: string) => Promise<void>;
  };
};

/** Internal buffer entry */
interface BufferedEvent {
  docId: string;
  userId?: string;
  createdAt: Date;
  updateData: Uint8Array;
}

/**
 * Create a synchronization slice that composes the CRDT slice and persists
 * Yjs updates into DuckDB (Ducklake) as crdt_events plus supports snapshots.
 */
export function createSyncSlice<PC extends BaseRoomConfig>(options: {
  /** DuckDB schema name to create/use for CRDT tables */
  schema?: string;
  /** Selector used by the underlying CRDT slice to split docs */
  crdtSelector?: (state: unknown) => Record<string, unknown>;
  /** Number of updates to buffer before flush */
  flushCount?: number;
  /** Time threshold (ms) to flush buffered updates */
  flushMs?: number;
  crdtOptions?: Parameters<typeof createCrdtSlice<PC, any>>[0];
}) {
  const schema = options?.schema ?? 'crdt';
  const flushCount = Math.max(1, options.flushCount ?? 200);
  const flushMs = Math.max(50, options.flushMs ?? 250);

  // Buffer and timer
  let buffer: BufferedEvent[] = [];
  let flushTimer: number | null = null;

  const scheduleFlush = (flush: () => Promise<void>) => {
    if (flushTimer != null) return;
    flushTimer = setTimeout(async () => {
      flushTimer = null;
      await flush();
    }, flushMs) as unknown as number;
  };

  return createSlice<PC, SyncSliceState>((set, get, store) => {
    const base = createCrdtSlice<PC, any>({
      selector: options.crdtSelector,
      ...(options.crdtOptions || {}),
    })(set, get, store as unknown as StoreApi<any>);

    // Wrap initialize to also init WS CRDT channels and forward updates
    const originalInitialize = base.crdt.initialize;
    let unsubscribeForward: (() => void) | undefined;
    const forwardSelector =
      options.crdtSelector || ((s: any) => ({config: s.config}));

    base.crdt.initialize = async () => {
      await originalInitialize?.();
      try {
        const connector = await get().db.getConnector();
        if (!isControlMessagesConnector(connector)) {
          throw new Error(
            'Provided connector does not support control messages, ' +
              'use e.g. WebSocketDuckDbConnector instead',
          );
        }
        const initial = forwardSelector(store.getState());
        // Request server state and subscribe
        for (const key of Object.keys(initial)) {
          try {
            connector.sendControlMessage({
              type: 'crdtInit',
              docId: key,
              branch: 'main',
            });
          } catch (e) {
            console.error('Failed to send CRDT init', key);
          }
          // Forward local changes as CRDT updates
          unsubscribeForward = store.subscribe((nextState, prevState) => {
            const nextSel = forwardSelector(nextState);
            const prevSel = forwardSelector(prevState);
            for (const [key, nextVal] of Object.entries(nextSel)) {
              const prevVal = prevSel[key as keyof typeof prevSel];
              if (prevVal !== nextVal) {
                try {
                  const doc = get().crdt.getDoc(key);
                  const bytes: Uint8Array = doc.export({mode: 'update'});
                  const b64 = btoa(String.fromCharCode(...bytes));
                  connector.sendControlMessage({
                    type: 'crdtUpdate',
                    docId: key,
                    branch: 'main',
                    data: b64,
                  });
                } catch (e) {
                  console.error('Failed to send CRDT update', key, e);
                }
              }
            }
          });

          // Listen for server CRDT updates and apply to local docs
          const listener = (payload: any) => {
            try {
              if (
                payload?.type === 'crdtUpdate' &&
                typeof payload?.docId === 'string' &&
                typeof payload?.data === 'string'
              ) {
                const key = payload.docId as string;
                const b64 = payload.data as string;
                const bytes = Uint8Array.from(atob(b64), (c) =>
                  c.charCodeAt(0),
                );
                get().crdt.applyRemoteUpdate(key, bytes);
              } else if (
                payload?.type === 'crdtState' &&
                typeof payload?.docId === 'string' &&
                typeof payload?.data === 'string'
              ) {
                const key = payload.docId as string;
                const b64 = payload.data as string;
                const bytes = Uint8Array.from(atob(b64), (c) =>
                  c.charCodeAt(0),
                );
                get().crdt.applyRemoteUpdate(key, bytes);
              }
            } catch (e) {
              console.error('Failed to apply CRDT update', payload);
            }
          };
          // Attach a per-connector listener using internal API
          try {
            connector.addNotificationListener(listener);
          } catch (e) {
            console.error('Failed to add CRDT listener');
          }
        }
      } catch {}
    };

    // Then, add sync API
    return {
      ...base,

      sync: {
        schema,

        ensureSchema: async () => {
          const connector = await get().db.getConnector();
          const s = schema;
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
          await connector.query(sql);
        },

        applyLocalUpdate: (
          key: string,
          update: Uint8Array,
          userId?: string,
        ) => {
          // Apply locally
          const doc = get().crdt.getDoc(key) as unknown as {
            import: (u: Uint8Array) => void;
          };
          doc.import(update);

          // Buffer for persistence; caller provides a stable docId per key
          buffer.push({
            docId: key,
            userId,
            createdAt: new Date(),
            updateData: update,
          });

          if (buffer.length >= flushCount) {
            void get().sync.flush();
          } else {
            scheduleFlush(get().sync.flush);
          }
        },

        flush: async () => {
          if (buffer.length === 0) return;
          const toWrite = buffer;
          buffer = [];
          const connector = await get().db.getConnector();
          const s = schema;
          const sql = `INSERT INTO ${s}.crdt_events (doc_id, created_at, user_id, update_data) VALUES ${toWrite
            .map(
              (e) =>
                `('${e.docId}', CURRENT_TIMESTAMP, ${e.userId ? `'${e.userId}'` : 'NULL'}, from_hex('${u8ToHex(
                  e.updateData,
                )}'))`,
            )
            .join(',')}`;
          await connector.query(sql);
        },

        snapshot: async (key: string, docId: string, createdBy?: string) => {
          const connector = await get().db.getConnector();
          const s = schema;
          const update = get().crdt.encodeDocAsUpdate(key);
          const hex = u8ToHex(update);
          const sql = `INSERT INTO ${s}.crdt_snapshots (snapshot_id, doc_id, created_at, created_by, data)
            VALUES (gen_random_uuid(), '${docId}', CURRENT_TIMESTAMP, ${createdBy ? `'${createdBy}'` : 'NULL'}, from_hex('${hex}'))`;
          await connector.query(sql);
        },

        recover: async (key: string, docId: string) => {
          const connector = await get().db.getConnector();
          const s = schema;
          // Get latest snapshot as hex to reconstruct bytes in JS
          const snapSql = `SELECT to_hex(data) AS hex, created_at FROM ${s}.crdt_snapshots WHERE doc_id='${docId}' ORDER BY created_at DESC LIMIT 1`;
          const snapRows = await connector.queryJson(snapSql);
          let since: string | null = null;
          if (snapRows) {
            for (const row of snapRows) {
              if (row?.hex) {
                const bytes = hexToU8(String(row.hex));
                const doc = get().crdt.getDoc(key) as unknown as {
                  import: (u: Uint8Array) => void;
                };
                doc.import(bytes);
                since = row.created_at as string;
              }
            }
          }
          const whereSince = since
            ? `AND created_at > TIMESTAMP '${since}'`
            : '';
          const evSql = `SELECT to_hex(update_data) AS hex FROM ${s}.crdt_events WHERE doc_id='${docId}' ${whereSince} ORDER BY event_id`;
          const evRows = await connector.queryJson(evSql);
          if (evRows) {
            for (const row of evRows) {
              const hex = row?.hex as string | undefined;
              if (!hex) continue;
              const bytes = hexToU8(hex);
              const doc = get().crdt.getDoc(key) as unknown as {
                import: (u: Uint8Array) => void;
              };
              doc.import(bytes);
            }
          }
        },
      },
    };
  });
}
