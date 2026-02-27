import {QueryDataTable} from '@sqlrooms/data-table';
import {TableSchemaTree} from '@sqlrooms/schema-tree';
import type {StoreApi} from '@sqlrooms/room-shell';
import {RoomShell} from '@sqlrooms/room-shell';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  Spinner,
} from '@sqlrooms/ui';
import {Link, useNavigate, useParams} from '@tanstack/react-router';
import {useEffect, useRef, useState} from 'react';
import {createRoomStore, RoomState, useRoomStore} from './room-store';
import {getRoom, getRoomsList} from './rooms-list';

export function RoomPage() {
  const {id} = useParams({from: '/room/$id'});
  return <RoomLoader key={id} roomId={id} />;
}

function RoomLoader({roomId}: {roomId: string}) {
  const roomConfig = getRoom(roomId);
  const storeRef = useRef<StoreApi<RoomState>>(null);

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
      <RoomContent roomId={roomId} roomName={roomConfig.name} />
    </RoomShell>
  );
}

function RoomContent({roomId, roomName}: {roomId: string; roomName: string}) {
  const navigate = useNavigate();
  const rooms = getRoomsList();
  const initialized = useRoomStore((s) => s.room.initialized);
  const schemaTrees = useRoomStore((s) => s.db.schemaTrees);
  const isRefreshing = useRoomStore((s) => s.db.isRefreshingTableSchemas);
  const refreshTableSchemas = useRoomStore((s) => s.db.refreshTableSchemas);

  useEffect(() => {
    if (!initialized) return;
    void refreshTableSchemas();
  }, [initialized, refreshTableSchemas, roomId]);

  const roomOptions =
    rooms.length > 0 ? rooms : [{id: roomId, name: roomName, defaultDataSources: []}];

  return (
    <SidebarProvider className="h-full">
      <Sidebar collapsible="offcanvas">
        <SidebarHeader className="border-sidebar-border border-b">
          <p className="text-sidebar-foreground/70 px-2 text-xs font-semibold uppercase tracking-wide">
            Project
          </p>
          <SidebarMenu>
            <SidebarMenuItem>
              <Select
                value={roomId}
                onValueChange={(nextRoomId) =>
                  navigate({to: '/room/$id', params: {id: nextRoomId}})
                }
              >
                <SelectTrigger className="bg-sidebar h-8 w-full shadow-none">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {roomOptions.map((room) => (
                    <SelectItem key={room.id} value={room.id}>
                      {room.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup className="p-0">
            <SidebarGroupLabel>Schema</SidebarGroupLabel>
            <SidebarGroupContent>
              {!initialized ? (
                <div className="flex items-center gap-2 px-2 py-1">
                  <Spinner />
                  <span className="text-muted-foreground text-xs">
                    Loading schema…
                  </span>
                </div>
              ) : schemaTrees && schemaTrees.length > 0 ? (
                <TableSchemaTree
                  schemaTrees={schemaTrees}
                  skipSingleDatabaseOrSchema
                  className="text-xs"
                />
              ) : (
                <p className="text-muted-foreground px-2 text-xs">
                  No tables loaded in this room.
                </p>
              )}
              {initialized && isRefreshing && (
                <p className="text-muted-foreground px-2 pt-2 text-[11px]">
                  Refreshing schema…
                </p>
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <div className="border-border flex items-center gap-3 border-b px-4 py-2">
          <SidebarTrigger />
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
      </SidebarInset>
    </SidebarProvider>
  );
}

function TableBrowser() {
  const initialized = useRoomStore((s) => s.room.initialized);
  const tables = useRoomStore((s) => s.db.tables);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  useEffect(() => {
    if (!initialized) return;
    if (tables.length === 0) {
      setSelectedTable(null);
      return;
    }
    if (!selectedTable || !tables.some((table) => table.table.table === selectedTable)) {
      setSelectedTable(tables[0].table.table);
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
    <div className="flex h-full flex-col">
      <div className="border-border flex items-center justify-end gap-2 border-b px-4 py-2">
        <span className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">
          Preview table
        </span>
        <Select value={selectedTable ?? undefined} onValueChange={setSelectedTable}>
          <SelectTrigger className="h-8 w-[260px]">
            <SelectValue placeholder="Select table" />
          </SelectTrigger>
          <SelectContent>
            {tables.map((t) => (
              <SelectItem key={t.table.table} value={t.table.table}>
                {t.table.table}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
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
