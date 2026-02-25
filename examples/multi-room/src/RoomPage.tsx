import {useParams, Link} from '@tanstack/react-router';
import {useEffect, useRef, useState} from 'react';
import type {StoreApi} from '@sqlrooms/room-shell';
import {RoomShell} from '@sqlrooms/room-shell';
import {QueryDataTable} from '@sqlrooms/data-table';
import {Spinner, Button} from '@sqlrooms/ui';
import {getRoom} from './rooms-list';
import {createRoomStore, useRoomStore, RoomState} from './room-store';

export function RoomPage() {
  const {id} = useParams({from: '/room/$id'});
  return <RoomLoader key={id} roomId={id} />;
}

function RoomLoader({roomId}: {roomId: string}) {
  const roomConfig = getRoom(roomId);
  const storeRef = useRef<StoreApi<RoomState>>();

  if (!storeRef.current && roomConfig) {
    storeRef.current = createRoomStore(roomId, roomConfig.defaultDataSources, {
      storeKey: roomId,
    });
  }

  if (!roomConfig) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Room not found.</p>
        <Link to="/" className="text-primary hover:underline">
          Back to rooms
        </Link>
      </div>
    );
  }

  if (!storeRef.current) return <CenteredSpinner />;

  return (
    <RoomShell roomStore={storeRef.current} className="h-full">
      <RoomContent roomName={roomConfig.name} />
    </RoomShell>
  );
}

function RoomContent({roomName}: {roomName: string}) {
  return (
    <div className="flex h-full w-full flex-col">
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
      <div className="flex-1 overflow-hidden">
        <TableBrowser />
      </div>
    </div>
  );
}

function TableBrowser() {
  const initialized = useRoomStore((s) => s.room.initialized);
  const tables = useRoomStore((s) => s.db.tables);
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

function CenteredSpinner() {
  return (
    <div className="flex h-full items-center justify-center">
      <Spinner />
    </div>
  );
}
