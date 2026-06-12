import {createArtifactLayoutNode} from '@sqlrooms/artifacts';
import {
  getAllTablesFromSchemaTrees,
  makeQualifiedTableName,
  type TableNodeObject,
} from '@sqlrooms/duckdb';
import {SchemaExplorer} from '@sqlrooms/sql-editor';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
} from '@sqlrooms/ui';
import {
  ArrowUpFromLine,
  Database,
  FileStackIcon,
  LoaderCircleIcon,
  Plus,
  SparklesIcon,
  Table2,
  TerminalIcon,
  Trash2Icon,
} from 'lucide-react';
import {useCallback, useMemo, useRef, useState, type ChangeEvent} from 'react';
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
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-sidebar-border gap-3 border-b group-data-[collapsible=icon]:border-b-0 group-data-[collapsible=icon]:py-1.5">
        <CliSidebarBrand />
      </SidebarHeader>
      <SidebarContent className="group-data-[collapsible=icon]:gap-0">
        <SidebarGroup className="border-sidebar-border border-b py-4 group-data-[collapsible=icon]:border-b-0 group-data-[collapsible=icon]:py-1">
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
      <SidebarFooter className="border-sidebar-border border-t group-data-[collapsible=icon]:border-t-0 group-data-[collapsible=icon]:py-1">
        <CliSidebarFooterControls onToggleSqlEditor={onToggleSqlEditor} />
      </SidebarFooter>
      <SidebarRail className="after:hidden" />
    </Sidebar>
  );
}

export function CliWorkspaceTopbar() {
  const roomTitle = useRoomStore((state) => state.room.config.title);
  const setRoomTitle = useRoomStore((state) => state.room.setRoomTitle);
  const currentArtifactId = useRoomStore(
    (state) => state.artifacts.config.currentArtifactId,
  );
  const currentArtifact = useRoomStore((state) =>
    currentArtifactId
      ? state.artifacts.config.artifactsById[currentArtifactId]
      : undefined,
  );
  const renameArtifact = useRoomStore((state) => state.artifacts.renameArtifact);
  const setShowArtifactChooser = useRoomStore(
    (state) => state.workspaceUi.setShowArtifactChooser,
  );
  const deleteArtifact = useRoomStore((state) => state.artifacts.deleteArtifact);
  const deleteTab = useRoomStore((state) => state.layout.deleteTab);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const handleTitleChange = useCallback(
    (nextTitle: string) => {
      const trimmedTitle = nextTitle.trim();
      if (trimmedTitle) {
        setRoomTitle(trimmedTitle);
      }
    },
    [setRoomTitle],
  );

  const handleArtifactTitleChange = useCallback(
    (nextTitle: string) => {
      const trimmedTitle = nextTitle.trim();
      if (currentArtifactId && trimmedTitle) {
        renameArtifact(currentArtifactId, trimmedTitle);
      }
    },
    [currentArtifactId, renameArtifact],
  );

  const handleConfirmDelete = useCallback(() => {
    if (currentArtifactId) {
      deleteArtifact(currentArtifactId);
      deleteTab('workspace', currentArtifactId);
    }
    setDeleteConfirmOpen(false);
  }, [currentArtifactId, deleteArtifact, deleteTab]);

  return (
    <header className="border-border bg-background/95 grid h-12 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b px-3">
      <div className="flex min-w-0 items-center gap-1.5">
        <CliSidebarToggleButton />
        <CliAssistantToggleButton />
      </div>
      <div className="flex min-w-0 max-w-[min(48rem,58vw)] items-center justify-center gap-1 text-center">
        <EditableText
          value={roomTitle}
          onChange={handleTitleChange}
          placeholder="Untitled Workspace"
          selectOnFocus
          className="text-foreground hover:bg-accent h-10 min-w-0 max-w-[24rem] border-transparent text-right text-2xl leading-none font-bold shadow-none ring-0 focus-visible:ring-1"
        />
        {currentArtifact ? (
          <>
            <span className="text-muted-foreground shrink-0 text-2xl leading-none font-semibold">
              /
            </span>
            <EditableText
              value={currentArtifact.title}
              onChange={handleArtifactTitleChange}
              placeholder="Untitled artifact"
              selectOnFocus
              className="text-foreground hover:bg-accent h-10 min-w-0 max-w-[20rem] border-transparent text-left text-2xl leading-none font-bold shadow-none ring-0 focus-visible:ring-1"
            />
          </>
        ) : null}
      </div>
      <div className="flex min-w-0 items-center justify-end gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive size-8"
                disabled={!currentArtifact}
                aria-label="Delete artifact"
                onClick={() => setDeleteConfirmOpen(true)}
              >
                <Trash2Icon className="h-4 w-4" aria-hidden />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {currentArtifact ? 'Delete artifact' : 'No artifact selected'}
          </TooltipContent>
        </Tooltip>
        <Button
          type="button"
          size="sm"
          className="h-8 gap-1.5 px-2 sm:px-3"
          aria-label="New artifact"
          onClick={() => setShowArtifactChooser(true)}
        >
          <Plus className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">New artifact</span>
        </Button>
      </div>
      <DeleteCurrentArtifactDialog
        artifactTitle={currentArtifact?.title}
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        onConfirm={handleConfirmDelete}
      />
    </header>
  );
}

function DeleteCurrentArtifactDialog({
  artifactTitle,
  open,
  onOpenChange,
  onConfirm,
}: {
  artifactTitle?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Delete artifact</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete &ldquo;
            {artifactTitle ?? 'this artifact'}&rdquo;? This action cannot be
            undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CliSidebarBrand() {
  const {setOpen} = useSidebar();

  return (
    <button
      className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex min-h-14 w-full min-w-0 items-center gap-3 rounded-md bg-transparent p-1 text-left group-data-[collapsible=icon]:min-h-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
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
                className="text-primary hover:text-primary border-sidebar-border bg-sidebar-accent/50 hover:bg-sidebar-accent h-10 justify-center border"
                onClick={addData}
                type="button"
              >
                <ArrowUpFromLine className="h-4 w-4" aria-hidden />
                <span>Add data</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <SchemaExplorer className="h-auto max-h-[min(48vh,440px)] py-1 pr-0 pl-0 [&_h2]:pl-1">
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
              className="hover:bg-sidebar-accent data-[state=open]:bg-sidebar-accent"
              type="button"
              size="lg"
              aria-label="Data"
            >
              <Database className="h-4 w-4" aria-hidden />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="bg-popover border-border [&_[role=menuitem]]:focus:bg-accent w-72"
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
  const openArtifactChooser = useRoomStore(
    (state) => state.workspaceUi.setShowArtifactChooser,
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
            onClick={() => openArtifactChooser(true)}
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
                  className="data-[active=true]:bg-primary/15 data-[active=true]:text-primary hover:bg-sidebar-accent h-7 gap-2 px-2 text-sm font-normal [&>svg]:size-3.5"
                  isActive={artifact.id === artifactTabs.selectedTabId}
                  onClick={() => artifactTabs.selectArtifact(artifact.id)}
                  type="button"
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">
                    {artifact.name}
                  </span>
                  {artifact.runningSessionCount > 0 ? (
                    <LoaderCircleIcon className="text-primary h-3.5 w-3.5 shrink-0 animate-spin" />
                  ) : null}
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
          className="hover:bg-sidebar-accent data-[state=open]:bg-sidebar-accent"
          type="button"
          size="lg"
          aria-label="Artifacts"
        >
          <FileStackIcon className="h-4 w-4" aria-hidden />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="bg-popover border-border [&_[role=menuitem]]:focus:bg-accent w-72"
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
              <span className="min-w-0 flex-1 truncate">{artifact.name}</span>
              {artifact.runningSessionCount > 0 ? (
                <LoaderCircleIcon className="text-primary ml-auto h-3.5 w-3.5 shrink-0 animate-spin" />
              ) : null}
            </DropdownMenuItem>
          );
        })}
        {artifactTabs.tabs.length === 0 ? (
          <DropdownMenuItem disabled>No artifacts</DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => openArtifactChooser(true)}>
          <Plus className="h-4 w-4" aria-hidden />
          New Artifact
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
            className="text-muted-foreground hover:bg-sidebar-accent hover:text-primary size-8"
            onClick={onToggleSqlEditor}
          >
            <TerminalIcon className="h-4 w-4" />
            <span className="sr-only">SQL Editor</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">SQL Editor</TooltipContent>
      </Tooltip>
      <RoomShell.CommandPalette.Button className="text-muted-foreground hover:bg-sidebar-accent hover:text-primary size-8 rounded-md" />
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="hover:bg-sidebar-accent flex size-8 items-center justify-center rounded-md">
            <ThemeSwitch className="data-[state=checked]:bg-primary/30 data-[state=unchecked]:bg-sidebar-accent" />
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
  const aiSessions = useRoomStore((state) => state.ai.config.sessions);
  const aiSessionArtifacts = useRoomStore(
    (state) => state.artifactAi.config.aiSessionArtifacts,
  );
  const selectedTabId = useRoomStore((state) =>
    state.layout.getActiveTab('workspace'),
  );
  const addTab = useRoomStore((state) => state.layout.addTab);
  const setActiveTab = useRoomStore((state) => state.layout.setActiveTab);
  const setCurrentArtifact = useRoomStore(
    (state) => state.artifacts.setCurrentArtifact,
  );
  const setShowArtifactChooser = useRoomStore(
    (state) => state.workspaceUi.setShowArtifactChooser,
  );

  const runningSessionCountsByArtifact = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const session of aiSessions) {
      if (!session.isRunning) continue;
      const artifactId = aiSessionArtifacts[session.id];
      if (!artifactId) continue;
      counts[artifactId] = (counts[artifactId] ?? 0) + 1;
    }
    return counts;
  }, [aiSessionArtifacts, aiSessions]);

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
          runningSessionCount: runningSessionCountsByArtifact[artifact.id] ?? 0,
        })),
    [
      artifactsConfig.artifactOrder,
      artifactsConfig.artifactsById,
      runningSessionCountsByArtifact,
    ],
  );

  const selectArtifact = useCallback(
    (artifactId: string) => {
      addTab('workspace', createArtifactLayoutNode(artifactId, 'artifact'));
      setActiveTab('workspace', artifactId);
      setCurrentArtifact(artifactId);
      setShowArtifactChooser(false);
    },
    [addTab, setActiveTab, setCurrentArtifact, setShowArtifactChooser],
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

function formatTableMeta(table: TableNodeObject) {
  const columnCount = table.columns.length;
  const columnLabel = `${columnCount} ${columnCount === 1 ? 'column' : 'columns'}`;
  if (table.rowCount === undefined) return columnLabel;
  return `${columnLabel}, ${table.rowCount.toLocaleString()} ${
    table.rowCount === 1 ? 'row' : 'rows'
  }`;
}
