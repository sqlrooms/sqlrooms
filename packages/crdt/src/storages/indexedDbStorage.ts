import {CrdtDocStorage} from '../createCrdtSlice';

type IndexedDbDocStorageOptions = {
  /**
   * IndexedDB database name.
   * @defaultValue "sqlrooms-crdt"
   */
  dbName?: string;
  /**
   * IndexedDB object store name.
   * @defaultValue "docs"
   */
  storeName?: string;
  /**
   * IndexedDB key to store the snapshot under.
   */
  key: string;
};

function openDb(dbName: string, storeName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('Failed to open IndexedDB'));
  });
}

function runTx<T>(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const req = fn(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

/**
 * Creates an IndexedDB-backed CRDT doc storage.
 *
 * Prefer IndexedDB over LocalStorage for larger snapshots and better durability.
 * In non-browser environments (SSR/tests without DOM), this storage becomes a no-op.
 */
export function createIndexedDbDocStorage(
  options: IndexedDbDocStorageOptions,
): CrdtDocStorage {
  const dbName = options.dbName ?? 'sqlrooms-crdt';
  const storeName = options.storeName ?? 'docs';
  const key = options.key;

  let dbPromise: Promise<IDBDatabase> | undefined;
  const getDb = async () => {
    if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
      return undefined;
    }
    dbPromise ??= openDb(dbName, storeName);
    return dbPromise;
  };

  return {
    async load() {
      const db = await getDb();
      if (!db) return undefined;
      try {
        const result = await runTx<unknown>(db, storeName, 'readonly', (s) =>
          s.get(key),
        );
        if (!result) return undefined;
        if (result instanceof ArrayBuffer) return new Uint8Array(result);
        if (ArrayBuffer.isView(result)) {
          const view = result as ArrayBufferView;
          return new Uint8Array(
            view.buffer.slice(
              view.byteOffset,
              view.byteOffset + view.byteLength,
            ),
          );
        }
        // Back-compat if someone stored a base64 string.
        if (typeof result === 'string') {
          const binary = atob(result);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i += 1) {
            bytes[i] = binary.charCodeAt(i);
          }
          return bytes;
        }
        return undefined;
      } catch (error) {
        console.warn('Failed to load CRDT snapshot from IndexedDB', error);
        return undefined;
      }
    },
    async save(data: Uint8Array) {
      const db = await getDb();
      if (!db) return;
      try {
        // Store as ArrayBuffer for broad structured-clone support.
        const buf = data.buffer.slice(
          data.byteOffset,
          data.byteOffset + data.byteLength,
        );
        await runTx(db, storeName, 'readwrite', (s) => s.put(buf, key));
      } catch (error) {
        console.warn('Failed to persist CRDT snapshot to IndexedDB', error);
      }
    },
  };
}
