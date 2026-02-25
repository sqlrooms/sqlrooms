import {DataSource} from '@sqlrooms/room-config';

export interface RoomRecord {
  id: string;
  name: string;
  dataSources: DataSource[];
  createdAt: number;
}

const DB_NAME = 'sqlrooms-multi-room';
const DB_VERSION = 1;
const STORE_NAME = 'rooms';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, {keyPath: 'id'});
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txStore(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

function reqPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllRooms(): Promise<RoomRecord[]> {
  const db = await openDb();
  try {
    const rooms = await reqPromise<RoomRecord[]>(
      txStore(db, 'readonly').getAll(),
    );
    return rooms.sort((a, b) => a.createdAt - b.createdAt);
  } finally {
    db.close();
  }
}

export async function getRoom(id: string): Promise<RoomRecord | undefined> {
  const db = await openDb();
  try {
    return await reqPromise<RoomRecord | undefined>(
      txStore(db, 'readonly').get(id),
    );
  } finally {
    db.close();
  }
}

export async function putRoom(room: RoomRecord): Promise<void> {
  const db = await openDb();
  try {
    await reqPromise(txStore(db, 'readwrite').put(room));
  } finally {
    db.close();
  }
}

export async function deleteRoom(id: string): Promise<void> {
  const db = await openDb();
  try {
    await reqPromise(txStore(db, 'readwrite').delete(id));
  } finally {
    db.close();
  }
}

export async function seedDefaultRooms(): Promise<void> {
  const existing = await getAllRooms();
  if (existing.length > 0) return;

  const defaults: RoomRecord[] = [
    {
      id: 'earthquakes',
      name: 'Earthquakes',
      dataSources: [
        {
          type: 'url',
          url: 'https://huggingface.co/datasets/sqlrooms/earthquakes/resolve/main/earthquakes.parquet',
          tableName: 'earthquakes',
        },
      ],
      createdAt: Date.now(),
    },
    {
      id: 'bixi',
      name: 'BIXI Locations 2025',
      dataSources: [
        {
          type: 'url',
          url: 'https://huggingface.co/datasets/sqlrooms/bixi-2025/resolve/main/bixi-locations-2025.parquet',
          tableName: 'bixi_locations',
        },
      ],
      createdAt: Date.now() + 1,
    },
  ];

  for (const room of defaults) {
    await putRoom(room);
  }
}
