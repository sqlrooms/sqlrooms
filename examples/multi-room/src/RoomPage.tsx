import {useParams, Link} from '@tanstack/react-router';
import {useEffect, useRef, useState} from 'react';
import {StoreApi, useStore} from 'zustand';
import {useRoomStoreApi} from '@sqlrooms/room-store';
import {RoomShell} from '@sqlrooms/room-shell';
import {QueryDataTable} from '@sqlrooms/data-table';
import {Spinner, Button} from '@sqlrooms/ui';
import {RoomRecord, getRoom} from './rooms-db';
import {createRoomStoreForSources, RoomState} from './room-store';

export function RoomPage() {
  const {id} = useParams({from: '/room/$id'});
  return <RoomLoader key={id} roomId={id} />;
}

function RoomLoader({roomId}: {roomId: string}) {
  const [roomRecord, setRoomRecord] = useState<RoomRecord | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getRoom(roomId).then((record) => {
      if (cancelled) return;
      if (record) setRoomRecord(record);
      else setNotFound(true);
    });
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  if (notFound) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Room not found.</p>
        <Link to="/" className="text-primary hover:underline">
          Back to rooms
        </Link>
      </div>
    );
  }

  if (!roomRecord) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return <RoomInstance roomRecord={roomRecord} />;
}

function RoomInstance({roomRecord}: {roomRecord: RoomRecord}) {
  const storeRef = useRef<StoreApi<RoomState> | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const store = createRoomStoreForSources(roomRecord.dataSources);
    storeRef.current = store;
    setReady(true);

    return () => {
      storeRef.current = null;
      setReady(false);
      store
        .getState()
        .room.destroy()
        .catch((err) => console.error('Error destroying room store:', err));
    };
  }, [roomRecord]);

  if (!ready || !storeRef.current) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <RoomShell roomStore={storeRef.current} className="h-full">
      <RoomContent roomName={roomRecord.name} />
    </RoomShell>
  );
}

function RoomContent({roomName}: {roomName: string}) {
  return (
    <div className="flex h-full w-full flex-col">
      <RoomHeader roomName={roomName} />
      <div className="flex-1 overflow-hidden">
        <TableBrowser />
      </div>
    </div>
  );
}

function RoomHeader({roomName}: {roomName: string}) {
  return (
    <div className="border-border flex items-center gap-3 border-b px-4 py-2">
      <Link
        to="/"
        className="text-muted-foreground hover:text-foreground text-sm"
      >
        ← Rooms
      </Link>
      <span className="text-muted-foreground">/</span>
      <span className="text-sm font-medium">{roomName}</span>
    </div>
  );
}

function TableBrowser() {
  const store = useRoomStoreApi<RoomState>();
  const initialized = useStore(store, (s) => s.room.initialized);
  const tables = useStore(store, (s) => s.db.tables);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  useEffect(() => {
    if (initialized && tables.length > 0 && !selectedTable) {
      setSelectedTable(tables[0].tableName);
    }
  }, [initialized, tables, selectedTable]);

  if (!initialized) {
    return (
      <div className="flex h-full items-center justify-center gap-2">
        <Spinner />
        <span className="text-muted-foreground text-sm">
          Loading data sources…
        </span>
      </div>
    );
  }

  if (tables.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground text-sm">
          No tables loaded in this room.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <aside className="border-border w-56 shrink-0 overflow-y-auto border-r p-3">
        <h3 className="text-muted-foreground mb-2 text-xs font-semibold uppercase">
          Tables
        </h3>
        <ul className="space-y-1">
          {tables.map((t) => (
            <li key={t.tableName}>
              <Button
                variant={selectedTable === t.tableName ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start text-xs"
                onClick={() => setSelectedTable(t.tableName)}
              >
                {t.tableName}
                <span className="text-muted-foreground ml-auto text-[10px]">
                  {t.columns.length} cols
                </span>
              </Button>
            </li>
          ))}
        </ul>
      </aside>
      <div className="flex-1 overflow-hidden">
        {selectedTable ? (
          <QueryDataTable
            key={selectedTable}
            query={`SELECT * FROM "${selectedTable}"`}
            fontSize="text-xs"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground text-sm">
              Select a table to preview
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
