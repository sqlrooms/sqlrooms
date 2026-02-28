import {QueryDataTable} from '@sqlrooms/data-table';
import {TableSchemaTree} from '@sqlrooms/schema-tree';
import type {StoreApi} from '@sqlrooms/room-shell';
import {RoomShell} from '@sqlrooms/room-shell';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarMenu,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  Spinner,
  useSidebar,
} from '@sqlrooms/ui';
import {
  AudioWaveform,
  BookOpen,
  ChevronRight,
  ChevronsUpDown,
  Command,
  Database,
  GalleryVerticalEnd,
  Plus,
  Settings2,
} from 'lucide-react';
import {Link, useNavigate, useParams} from '@tanstack/react-router';
import {useEffect, useRef, useState} from 'react';
import {createRoomStore, RoomState, useRoomStore} from './room-store';
import {addRoom, getRoom, getRoomsList} from './rooms-list';

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
  const tables = useRoomStore((s) => s.db.tables);
  const schemaTrees = useRoomStore((s) => s.db.schemaTrees);
  const isRefreshing = useRoomStore((s) => s.db.isRefreshingTableSchemas);
  const refreshTableSchemas = useRoomStore((s) => s.db.refreshTableSchemas);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  useEffect(() => {
    if (!initialized) return;
    void refreshTableSchemas();
  }, [initialized, refreshTableSchemas, roomId]);

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

  const roomOptions =
    rooms.length > 0 ? rooms : [{id: roomId, name: roomName, defaultDataSources: []}];

  const onRoomSelect = (nextRoomId: string) => {
    navigate({to: '/room/$id', params: {id: nextRoomId}});
  };

  const onAddRoom = () => {
    const newRoom = {
      id: crypto.randomUUID(),
      name: `Room ${rooms.length + 1}`,
      defaultDataSources: [],
    };
    addRoom(newRoom);
    onRoomSelect(newRoom.id);
  };

  return (
    <SidebarProvider className="h-full">
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <TeamSwitcher
            rooms={roomOptions}
            activeRoomId={roomId}
            onRoomSelect={onRoomSelect}
            onAddRoom={onAddRoom}
          />
        </SidebarHeader>
        <SidebarContent>
          <NavMain
            tables={tables}
            selectedTable={selectedTable}
            onSelectTable={setSelectedTable}
          />
          <SidebarGroup className="group-data-[collapsible=icon]:hidden">
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
        <SidebarFooter>
          <RoomUserMenu roomName={roomName} />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header className="border-border flex h-12 shrink-0 items-center gap-2 border-b px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-10">
          <SidebarTrigger className="-ml-1" />
          <Link
            to="/"
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            Rooms
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium">{roomName}</span>
        </header>
        <div className="flex-1 overflow-hidden">
          <TableBrowser
            initialized={initialized}
            tables={tables}
            selectedTable={selectedTable}
            onSelectTable={setSelectedTable}
          />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function TeamSwitcher({
  rooms,
  activeRoomId,
  onRoomSelect,
  onAddRoom,
}: {
  rooms: {id: string; name: string; defaultDataSources: unknown[]}[];
  activeRoomId: string;
  onRoomSelect: (roomId: string) => void;
  onAddRoom: () => void;
}) {
  const {isMobile} = useSidebar();
  const activeRoomIndex = rooms.findIndex((room) => room.id === activeRoomId);
  const resolvedIndex = activeRoomIndex >= 0 ? activeRoomIndex : 0;
  const activeRoom = rooms[resolvedIndex];

  if (!activeRoom) return null;
  const ActiveLogo = getRoomLogo(resolvedIndex);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <ActiveLogo className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{activeRoom.name}</span>
                <span className="truncate text-xs">
                  {activeRoom.defaultDataSources.length} source
                  {activeRoom.defaultDataSources.length !== 1 ? 's' : ''}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-muted-foreground text-xs">
                Rooms
              </DropdownMenuLabel>
              {rooms.map((room, index) => {
                const RoomLogo = getRoomLogo(index);
                return (
                  <DropdownMenuItem
                    key={room.id}
                    onClick={() => onRoomSelect(room.id)}
                    className="gap-2 p-2"
                  >
                    <div className="flex size-6 items-center justify-center rounded-md border">
                      <RoomLogo className="size-3.5 shrink-0" />
                    </div>
                    <span className="truncate">{room.name}</span>
                    <DropdownMenuShortcut>{index + 1}</DropdownMenuShortcut>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 p-2" onClick={onAddRoom}>
              <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                <Plus className="size-4" />
              </div>
              <div className="text-muted-foreground font-medium">Add room</div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function NavMain({
  tables,
  selectedTable,
  onSelectTable,
}: {
  tables: {table: {table: string}}[];
  selectedTable: string | null;
  onSelectTable: (tableName: string) => void;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Platform</SidebarGroupLabel>
      <SidebarMenu>
        <Collapsible defaultOpen className="group/collapsible" asChild>
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton tooltip="Tables">
                <Database />
                <span>Tables</span>
                <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                {tables.length > 0 ? (
                  tables.map((table) => (
                    <SidebarMenuSubItem key={table.table.table}>
                      <SidebarMenuSubButton asChild isActive={selectedTable === table.table.table}>
                        <a
                          href="#"
                          onClick={(event) => {
                            event.preventDefault();
                            onSelectTable(table.table.table);
                          }}
                        >
                          <span>{table.table.table}</span>
                        </a>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))
                ) : (
                  <SidebarMenuSubItem>
                    <span className="text-muted-foreground px-2 py-1 text-xs">
                      No tables loaded
                    </span>
                  </SidebarMenuSubItem>
                )}
              </SidebarMenuSub>
            </CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible>
        <SidebarMenuItem>
          <SidebarMenuButton tooltip="Schema tree">
            <BookOpen />
            <span>Schema tree</span>
          </SidebarMenuButton>
          <SidebarMenuBadge>{tables.length}</SidebarMenuBadge>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton asChild tooltip="Rooms list">
            <Link to="/">
              <Settings2 />
              <span>Rooms list</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
}

function RoomUserMenu({roomName}: {roomName: string}) {
  const {isMobile} = useSidebar();
  const roomInitial = roomName.charAt(0).toUpperCase();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex size-8 items-center justify-center rounded-lg text-xs font-semibold">
                {roomInitial}
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">SQLRooms</span>
                <span className="truncate text-xs">{roomName}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Workspace
            </DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link to="/">Open rooms list</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function TableBrowser({
  initialized,
  tables,
  selectedTable,
  onSelectTable,
}: {
  initialized: boolean;
  tables: {table: {table: string}}[];
  selectedTable: string | null;
  onSelectTable: (tableName: string) => void;
}) {

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
        <Select value={selectedTable ?? undefined} onValueChange={onSelectTable}>
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

const ROOM_SWITCHER_LOGOS = [GalleryVerticalEnd, AudioWaveform, Command];

function getRoomLogo(index: number) {
  return ROOM_SWITCHER_LOGOS[index % ROOM_SWITCHER_LOGOS.length];
}

function CenteredSpinner() {
  return (
    <div className="flex h-full items-center justify-center">
      <Spinner />
    </div>
  );
}
