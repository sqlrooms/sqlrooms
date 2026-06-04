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
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
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
  Database,
  FileStackIcon,
  Plus,
  SparklesIcon,
  Table2,
  TerminalIcon,
  UploadCloud,
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

export function CliWorkspaceSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-3 border-b border-sidebar-border">
        <CliSidebarBrand />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Data</SidebarGroupLabel>
          <SidebarGroupContent>
            <CliDataSidebarSection />
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Artifacts</SidebarGroupLabel>
          <SidebarGroupContent>
            <CliArtifactsSidebarSection />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}

export function CliWorkspaceTopbar({
  onToggleSqlEditor,
}: {
  onToggleSqlEditor: () => void;
}) {
  return (
    <header className="grid h-12 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b border-border bg-background/95 px-3">
      <div className="flex min-w-0 items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <SidebarTrigger className="size-9 text-muted-foreground hover:text-foreground" />
          </TooltipTrigger>
          <TooltipContent>Toggle sidebar</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 text-muted-foreground hover:text-foreground"
              onClick={onToggleSqlEditor}
            >
              <TerminalIcon className="h-4 w-4" />
              <span className="sr-only">SQL Editor</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>SQL Editor</TooltipContent>
        </Tooltip>
        <CliAssistantToggleButton />
      </div>
      <h1 className="min-w-0 truncate text-center text-2xl leading-none font-bold text-foreground">
        Untitled Workspace
      </h1>
      <div className="flex min-w-0 items-center justify-end gap-1.5">
        <RoomShell.CommandPalette.Button className="size-9 text-muted-foreground hover:text-foreground" />
        <ThemeSwitch />
      </div>
    </header>
  );
}

function CliSidebarBrand() {
  const {setOpen} = useSidebar();

  return (
    <button
      className="flex min-h-14 w-full min-w-0 items-center gap-3 rounded-md bg-transparent p-1 text-left text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:min-h-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
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
        <div className="truncate text-sm leading-tight text-muted-foreground">
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
                className="min-h-10 bg-primary text-base text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                onClick={addData}
                type="button"
                size="lg"
              >
                <UploadCloud className="h-4 w-4" aria-hidden />
                <span>Add data</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <SchemaExplorer className="h-auto max-h-[min(48vh,440px)] border-l border-sidebar-border py-1 pr-0 pl-3">
            <SchemaExplorer.Header title="main">
              <SchemaExplorer.RefreshButton />
            </SchemaExplorer.Header>
            <SchemaExplorer.Tree />
          </SchemaExplorer>
        </div>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              type="button"
              size="lg"
              aria-label="Data"
            >
              <Database className="h-4 w-4" aria-hidden />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-72 bg-popover"
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
                  <small className="truncate text-xs text-muted-foreground">
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
              <UploadCloud className="h-4 w-4" aria-hidden />
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
  const createWorksheet = useCreateWorksheetArtifact(artifactTabs.selectArtifact);
  const {state} = useSidebar();

  if (state === 'expanded') {
    return (
      <SidebarMenu>
        {artifactTabs.tabs.map((artifact) => {
          const type = artifactTabs.artifactTypes[artifact.type];
          const Icon = type?.icon ?? FileStackIcon;
          return (
            <SidebarMenuItem key={artifact.id}>
              <SidebarMenuButton
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
        <SidebarMenuItem>
          <SidebarMenuButton type="button" onClick={() => void createWorksheet()}>
            <Plus className="h-4 w-4" aria-hidden />
            <span>New Worksheet</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  const activeArtifact = artifactTabs.tabs.find(
    (artifact) => artifact.id === artifactTabs.selectedTabId,
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          type="button"
          size="lg"
          aria-label="Artifacts"
          isActive={Boolean(activeArtifact)}
        >
          <FileStackIcon className="h-4 w-4" aria-hidden />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-72 bg-popover"
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
          className="size-9 text-muted-foreground hover:text-foreground data-[active=true]:bg-accent data-[active=true]:text-foreground"
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
