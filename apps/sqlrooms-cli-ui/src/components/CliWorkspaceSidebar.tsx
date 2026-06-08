import {createArtifactLayoutNode} from '@sqlrooms/artifacts';
import {
  getAllTablesFromSchemaTrees,
  makeQualifiedTableName,
  type TableNodeObject,
} from '@sqlrooms/duckdb';
import {SchemaExplorer} from '@sqlrooms/sql-editor';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EditableText,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  ThemeSwitch,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  useSidebar,
  toast,
} from '@sqlrooms/ui';
import {
  ArrowUpFromLine,
  Database,
  FileStackIcon,
  Plus,
  SparklesIcon,
  Table2,
  TerminalIcon,
} from 'lucide-react';
import {useCallback, useMemo, useRef, type ChangeEvent} from 'react';
import {CLI_ARTIFACT_TYPES, type CliArtifactType} from '../artifactTypeIds';
import {RoomShell} from '@sqlrooms/room-shell';
import {useRoomStore} from '../store';
import {
  LOCAL_DATA_ACCEPTED_FORMATS,
  useLocalFileLoader,
} from './useLocalFileLoader';

const acceptedDataFileExtensions = Object.values(LOCAL_DATA_ACCEPTED_FORMATS)
  .flat()
  .join(',');

export function CliWorkspaceSidebar({
  onToggleSqlEditor,
}: {
  onToggleSqlEditor: () => void;
}) {
  return (
    <Sidebar
      collapsible="icon"
      className="[&_[data-sidebar=sidebar]]:border-blue-900/40 [&_[data-sidebar=sidebar]]:bg-blue-950/20"
    >
      <SidebarHeader className="gap-3 border-b border-blue-900/40 group-data-[collapsible=icon]:border-b-0 group-data-[collapsible=icon]:py-1.5">
        <CliSidebarBrand />
      </SidebarHeader>
      <SidebarContent className="group-data-[collapsible=icon]:gap-0">
        <SidebarGroup className="border-b border-blue-900/40 py-4 group-data-[collapsible=icon]:border-b-0 group-data-[collapsible=icon]:py-1">
          <SidebarGroupContent>
            <CliDataSidebarSection />
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="group-data-[collapsible=icon]:py-1">
          <SidebarGroupContent>
            <CliArtifactsSidebarSection />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-blue-900/40 group-data-[collapsible=icon]:border-t-0 group-data-[collapsible=icon]:py-1">
        <CliSidebarFooterControls onToggleSqlEditor={onToggleSqlEditor} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

export function CliWorkspaceTopbar() {
  const roomTitle = useRoomStore((state) => state.room.config.title);
  const setRoomTitle = useRoomStore((state) => state.room.setRoomTitle);

  const handleTitleChange = useCallback(
    (nextTitle: string) => {
      const trimmedTitle = nextTitle.trim();
      if (trimmedTitle) {
        setRoomTitle(trimmedTitle);
      }
    },
    [setRoomTitle],
  );

  return (
    <header className="border-border bg-background/95 grid h-12 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b px-3">
      <div className="flex min-w-0 items-center gap-1.5">
        <CliSidebarToggleButton />
        <CliAssistantToggleButton />
      </div>
      <EditableText
        value={roomTitle}
        onChange={handleTitleChange}
        placeholder="Untitled Workspace"
        selectOnFocus
        className="text-foreground h-10 max-w-[min(48rem,60vw)] min-w-0 border-transparent text-center text-2xl leading-none font-bold shadow-none ring-0 hover:bg-blue-950/30 focus-visible:ring-1"
      />
      <div />
    </header>
  );
}

function CliSidebarBrand() {
  const {setOpen} = useSidebar();

  return (
    <button
      className="text-sidebar-foreground hover:text-sidebar-foreground flex min-h-14 w-full min-w-0 items-center gap-3 rounded-md bg-transparent p-1 text-left group-data-[collapsible=icon]:min-h-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0 hover:bg-blue-950/30"
      type="button"
      onClick={() => setOpen(true)}
      aria-label="Open sidebar"
    >
      <img
        className="size-10 shrink-0 object-contain group-data-[collapsible=icon]:size-7"
        src="/logo.png"
        alt=""
      />
      <div className="min-w-0 group-data-[collapsible=icon]:hidden">
        <div className="truncate text-xl leading-none font-bold">SQLRooms</div>
        <div className="text-muted-foreground truncate text-sm leading-tight">
          Analytics workspaces
        </div>
      </div>
    </button>
  );
}

function CliDataSidebarSection() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const loadLocalFiles = useLocalFileLoader();
  const schemaTrees = useRoomStore((state) => state.db.schemaTrees);
  const selectTable = useRoomStore((state) => state.sqlEditor.selectTable);
  const tables = useMemo(
    () => getAllTablesFromSchemaTrees(schemaTrees),
    [schemaTrees],
  );
  const {state} = useSidebar();

  const addData = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.currentTarget.files ?? []);
      event.currentTarget.value = '';
      if (files.length > 0) {
        void loadLocalFiles(files);
      }
    },
    [loadLocalFiles],
  );

  const handleSelectTable = useCallback(
    (table: TableNodeObject) => {
      const qualifiedTableName = makeQualifiedTableName({
        database: table.table.database,
        schema: table.table.schema,
        table: table.table.table,
      }).toString();
      selectTable(qualifiedTableName);
    },
    [selectTable],
  );

  return (
    <>
      {state === 'expanded' ? (
        <div className="grid min-h-0 gap-3">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                className="text-primary hover:text-primary h-10 justify-center border border-blue-800/60 bg-blue-950/30 hover:bg-blue-900/30"
                onClick={addData}
                type="button"
              >
                <ArrowUpFromLine className="h-4 w-4" aria-hidden />
                <span>Add data</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <SchemaExplorer className="h-auto max-h-[min(48vh,440px)] border-l border-blue-900/40 py-1 pr-0 pl-3">
            <SchemaExplorer.Header title="Data">
              <SchemaExplorer.RefreshButton />
            </SchemaExplorer.Header>
            <SchemaExplorer.Tree />
          </SchemaExplorer>
        </div>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              className="hover:bg-blue-900/30 data-[state=open]:bg-blue-900/30"
              type="button"
              size="lg"
              aria-label="Data"
            >
              <Database className="h-4 w-4" aria-hidden />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="bg-popover w-72 border-blue-900/40 [&_[role=menuitem]]:focus:bg-blue-950/70"
            align="start"
            side="right"
            sideOffset={8}
          >
            <DropdownMenuLabel>Tables</DropdownMenuLabel>
            {tables.map((table) => (
              <DropdownMenuItem
                key={`${table.table.database ?? ''}.${table.table.schema}.${table.table.table}`}
                onClick={() => handleSelectTable(table)}
              >
                <Table2 className="h-4 w-4" aria-hidden />
                <div className="grid min-w-0 gap-px">
                  <span className="truncate">{table.name}</span>
                  <small className="text-muted-foreground truncate text-xs">
                    {formatTableMeta(table)}
                  </small>
                </div>
              </DropdownMenuItem>
            ))}
            {tables.length === 0 ? (
              <DropdownMenuItem disabled>No tables</DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={addData}>
              <ArrowUpFromLine className="h-4 w-4" aria-hidden />
              Add data
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <input
        ref={fileInputRef}
        className="sr-only"
        type="file"
        multiple
        accept={acceptedDataFileExtensions}
        onChange={handleFileInputChange}
        tabIndex={-1}
      />
    </>
  );
}

function CliArtifactsSidebarSection() {
  const artifactTabs = useCliArtifactSidebarTabs();
  const createWorksheet = useCreateWorksheetArtifact(
    artifactTabs.selectArtifact,
  );
  const {state} = useSidebar();

  if (state === 'expanded') {
    return (
      <>
        <div className="mb-1 flex h-7 items-center justify-between px-2">
          <div className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            Artifacts
          </div>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="text-primary hover:bg-primary/10 hover:text-primary h-6 gap-1 px-2 text-sm"
            onClick={() => void createWorksheet()}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            New
          </Button>
        </div>
        <SidebarMenu className="gap-0.5">
          {artifactTabs.tabs.map((artifact) => {
            const type = artifactTabs.artifactTypes[artifact.type];
            const Icon = type?.icon ?? FileStackIcon;
            return (
              <SidebarMenuItem key={artifact.id}>
                <SidebarMenuButton
                  className="data-[active=true]:bg-primary/15 data-[active=true]:text-primary h-7 gap-2 px-2 text-sm font-normal hover:bg-blue-950/40 [&>svg]:size-3.5"
                  isActive={artifact.id === artifactTabs.selectedTabId}
                  onClick={() => artifactTabs.selectArtifact(artifact.id)}
                  type="button"
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  <span>{artifact.name}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          className="hover:bg-blue-900/30 data-[state=open]:bg-blue-900/30"
          type="button"
          size="lg"
          aria-label="Artifacts"
        >
          <FileStackIcon className="h-4 w-4" aria-hidden />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="bg-popover w-72 border-blue-900/40 [&_[role=menuitem]]:focus:bg-blue-950/70"
        align="start"
        side="right"
        sideOffset={8}
      >
        <DropdownMenuLabel>Artifacts</DropdownMenuLabel>
        {artifactTabs.tabs.map((artifact) => {
          const type = artifactTabs.artifactTypes[artifact.type];
          const Icon = type?.icon ?? FileStackIcon;
          return (
            <DropdownMenuItem
              key={artifact.id}
              onClick={() => artifactTabs.selectArtifact(artifact.id)}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {artifact.name}
            </DropdownMenuItem>
          );
        })}
        {artifactTabs.tabs.length === 0 ? (
          <DropdownMenuItem disabled>No artifacts</DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void createWorksheet()}>
          <Plus className="h-4 w-4" aria-hidden />
          New Worksheet
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CliSidebarFooterControls({
  onToggleSqlEditor,
}: {
  onToggleSqlEditor: () => void;
}) {
  return (
    <div className="flex items-center gap-1 group-data-[collapsible=icon]:flex-col">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-primary size-8 hover:bg-blue-900/30"
            onClick={onToggleSqlEditor}
          >
            <TerminalIcon className="h-4 w-4" />
            <span className="sr-only">SQL Editor</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">SQL Editor</TooltipContent>
      </Tooltip>
      <RoomShell.CommandPalette.Button className="text-muted-foreground hover:text-primary size-8 rounded-md hover:bg-blue-900/30" />
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex size-8 items-center justify-center rounded-md hover:bg-blue-900/30">
            <ThemeSwitch className="data-[state=checked]:bg-primary/30 data-[state=unchecked]:bg-blue-950/70" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">Toggle theme</TooltipContent>
      </Tooltip>
    </div>
  );
}

function useCliArtifactSidebarTabs() {
  const artifactsConfig = useRoomStore((state) => state.artifacts.config);
  const artifactTypes = useRoomStore((state) => state.artifacts.artifactTypes);
  const selectedTabId = useRoomStore((state) =>
    state.layout.getActiveTab('workspace'),
  );
  const addTab = useRoomStore((state) => state.layout.addTab);
  const setActiveTab = useRoomStore((state) => state.layout.setActiveTab);
  const setCurrentArtifact = useRoomStore(
    (state) => state.artifacts.setCurrentArtifact,
  );

  const tabs = useMemo(
    () =>
      artifactsConfig.artifactOrder
        .map((artifactId) => artifactsConfig.artifactsById[artifactId])
        .filter((artifact) => {
          return (
            artifact &&
            CLI_ARTIFACT_TYPES.includes(artifact.type as CliArtifactType) &&
            artifact.visibility === 'workspace'
          );
        })
        .map((artifact) => ({
          id: artifact.id,
          name: artifact.title,
          type: artifact.type,
        })),
    [artifactsConfig.artifactOrder, artifactsConfig.artifactsById],
  );

  const selectArtifact = useCallback(
    (artifactId: string) => {
      addTab('workspace', createArtifactLayoutNode(artifactId, 'artifact'));
      setActiveTab('workspace', artifactId);
      setCurrentArtifact(artifactId);
    },
    [addTab, setActiveTab, setCurrentArtifact],
  );

  return {artifactTypes, selectedTabId, selectArtifact, tabs};
}

function CliSidebarToggleButton() {
  const {state} = useSidebar();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <SidebarTrigger
          className="text-muted-foreground hover:text-foreground data-[active=true]:bg-accent data-[active=true]:text-foreground size-9"
          data-active={state === 'expanded'}
        />
      </TooltipTrigger>
      <TooltipContent>Toggle sidebar</TooltipContent>
    </Tooltip>
  );
}

function CliAssistantToggleButton() {
  const toggleCollapsed = useRoomStore((state) => state.layout.toggleCollapsed);
  const isAssistantCollapsed = useRoomStore((state) =>
    state.layout.isCollapsed('assistant-sidebar'),
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground data-[active=true]:bg-accent data-[active=true]:text-foreground size-9"
          onClick={() => toggleCollapsed('assistant-sidebar')}
          data-active={!isAssistantCollapsed}
        >
          <SparklesIcon className="h-4 w-4" />
          <span className="sr-only">AI Assistant</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>AI Assistant</TooltipContent>
    </Tooltip>
  );
}

function useCreateWorksheetArtifact(
  selectArtifact: (artifactId: string) => void,
) {
  const invokeCommand = useRoomStore((state) => state.commands.invokeCommand);

  return useCallback(async () => {
    let result: Awaited<ReturnType<typeof invokeCommand>>;
    try {
      result = await invokeCommand('worksheet.create-artifact', undefined, {
        surface: 'api',
        actor: 'cli-sidebar',
      });
    } catch (error) {
      toast.error('Failed to create worksheet', {
        description:
          error instanceof Error ? error.message : 'An unknown error occurred',
      });
      return undefined;
    }

    const artifactId =
      result.success &&
      result.data &&
      typeof result.data === 'object' &&
      'artifactId' in result.data &&
      typeof result.data.artifactId === 'string'
        ? result.data.artifactId
        : undefined;
    if (artifactId) {
      selectArtifact(artifactId);
    }
    return artifactId;
  }, [invokeCommand, selectArtifact]);
}

function formatTableMeta(table: TableNodeObject) {
  const columnCount = table.columns.length;
  const columnLabel = `${columnCount} ${columnCount === 1 ? 'column' : 'columns'}`;
  if (table.rowCount === undefined) return columnLabel;
  return `${columnLabel}, ${table.rowCount.toLocaleString()} ${
    table.rowCount === 1 ? 'row' : 'rows'
  }`;
}
