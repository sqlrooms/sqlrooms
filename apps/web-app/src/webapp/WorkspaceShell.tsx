import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {Link, useNavigate} from '@tanstack/react-router';
import {AiSliceConfig, createAiSlice, type AiSliceState} from '@sqlrooms/ai';
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
  Input,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  useSidebar,
} from '@sqlrooms/ui';
import {
  LayoutRenderer,
  createLayoutSlice,
  type LayoutNode,
  type LayoutSliceState,
  type Panels,
} from '@sqlrooms/layout';
import {
  RoomStateProvider,
  createBaseRoomSlice,
  createRoomStoreCreator,
  type BaseRoomStoreState,
  type StoreApi,
} from '@sqlrooms/room-store';
import {generateUniqueName} from '@sqlrooms/utils';
import {
  ChevronDown,
  Database,
  Eye,
  FileSpreadsheet,
  FolderKanban,
  LogIn,
  LogOut,
  Plus,
  Save,
  Settings,
  Sparkles,
  UploadCloud,
  Table2,
} from 'lucide-react';
import type React from 'react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {authClient, getNeonJWTToken} from '#/lib/auth-client';
import type {JsonObject} from '#/lib/json';
import {AssistantPanel} from './assistant/AssistantPanel';
import {
  createTableName,
  dropWorkspaceTable,
  loadSavedWorkspaceFile,
  prepareWorkspaceFile,
  uploadPreparedWorkspaceFile,
  type PreparedWorkspaceFile,
} from './files/fileIngestion';
import {WorksheetSurface} from './WorksheetSurface';
import {deleteWorkspaceFile, listWorkspaceFiles} from './workspace/files';
import {
  createCloudWorkspace,
  getCloudWorkspace,
  listCloudWorkspaces,
  renameCloudWorkspace,
  saveWorkspaceAiConfig,
  saveWorkspaceLayout,
} from './workspace/cloudWorkspaces';
import {createDefaultWorksheetContent} from './worksheet/defaultBlockDocument';
import {useWorkspaceDuckDbRuntime} from './worksheet/useWorkspaceDuckDbRuntime';

type WorkspaceShellProps =
  | {
      mode: 'unsaved';
      workspaceId?: never;
    }
  | {
      mode: 'saved';
      workspaceId: string;
    };

type LocalWorksheet = {
  id: string;
  title: string;
  content: JsonObject;
};

type FileConflictResolution =
  | {action: 'replace'}
  | {action: 'keep-both'; tableName: string}
  | {action: 'cancel'};

type FileNameConflict = {
  fileName: string;
  tableName: string;
  uniqueTableName: string;
  resolve: (resolution: FileConflictResolution) => void;
};

type SchemaTableItem = {
  key: string;
  name: string;
  meta: string;
};

type TablePreview = {
  tableName: string;
  columns: string[];
  rows: Record<string, unknown>[];
  status: 'loading' | 'ready' | 'error';
  error?: string;
};

const cloudWorkspacesQueryKey = ['cloudWorkspaces'] as const;
const ASSISTANT_PANEL_ID = 'assistant-panel';

type WorkspaceLayoutRoomState = BaseRoomStoreState & LayoutSliceState;
type WorkspaceRoomState = WorkspaceLayoutRoomState & AiSliceState;

function createDefaultWorkspaceLayout(): LayoutNode {
  return {
    type: 'split',
    id: 'workspace-root-layout',
    direction: 'row',
    children: [
      {
        type: 'panel',
        id: ASSISTANT_PANEL_ID,
        panel: 'assistant',
        defaultSize: '320px',
        minSize: '260px',
        maxSize: '560px',
        collapsible: true,
        collapsedSize: 0,
      },
      {
        type: 'panel',
        id: 'worksheet-panel',
        panel: 'worksheet',
        defaultSize: '75%',
        minSize: '360px',
      },
    ],
  };
}

function createDefaultWorkspaceAiConfig(): JsonObject {
  return {sessions: [], openSessionTabs: []};
}

export function WorkspaceShell(props: WorkspaceShellProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const {data: session} = authClient.useSession();
  const [localWorkspaceName, setLocalWorkspaceName] =
    useState('Untitled Workspace');
  const [savedWorkspaceNameDraft, setSavedWorkspaceNameDraft] = useState('');
  const [isSignInToSaveOpen, setIsSignInToSaveOpen] = useState(false);
  const [preparedLocalFiles, setPreparedLocalFiles] = useState<
    PreparedWorkspaceFile[]
  >([]);
  const [fileIngestionStatus, setFileIngestionStatus] = useState<string | null>(
    null,
  );
  const [fileNameConflict, setFileNameConflict] =
    useState<FileNameConflict | null>(null);
  const [selectedWorksheetId, setSelectedWorksheetId] = useState<string | null>(
    null,
  );
  const [workspaceLayout, setWorkspaceLayout] = useState<LayoutNode>(() =>
    createDefaultWorkspaceLayout(),
  );
  const [workspaceAiConfig, setWorkspaceAiConfig] = useState<JsonObject>(() =>
    createDefaultWorkspaceAiConfig(),
  );
  const [localWorksheets] = useState<LocalWorksheet[]>(() => [
    {
      id: 'default-worksheet',
      title: 'Worksheet',
      content: createDefaultWorksheetContent(),
    },
  ]);
  const savedWorkspaceId = props.mode === 'saved' ? props.workspaceId : null;
  const activeWorkspaceId = savedWorkspaceId ?? 'unsaved-default';
  const duckDbRuntime = useWorkspaceDuckDbRuntime(activeWorkspaceId);

  const isSignedIn = Boolean(session?.user);
  const tokenQuery = useQuery({
    queryKey: ['neonAuthToken', session?.user.id],
    queryFn: () => getNeonJWTToken(),
    enabled: isSignedIn,
  });
  const token = tokenQuery.data ?? null;

  const workspacesQuery = useQuery({
    queryKey: [...cloudWorkspacesQueryKey, token],
    queryFn: () => listCloudWorkspaces({data: {token: token!}}),
    enabled: Boolean(token),
  });

  const savedWorkspaceQuery = useQuery({
    queryKey: ['cloudWorkspace', props.mode, props.workspaceId, token],
    queryFn: () =>
      getCloudWorkspace({
        data: {token: token!, workspaceId: props.workspaceId!},
      }),
    enabled: Boolean(token && props.mode === 'saved'),
  });

  const workspaceFilesQuery = useQuery({
    queryKey: ['workspaceFiles', props.mode, props.workspaceId, token],
    queryFn: () =>
      listWorkspaceFiles({
        data: {token: token!, workspaceId: props.workspaceId!},
      }),
    enabled: Boolean(token && props.mode === 'saved'),
  });

  const createWorkspaceMutation = useMutation({
    mutationFn: createCloudWorkspace,
  });

  const renameWorkspaceMutation = useMutation({
    mutationFn: renameCloudWorkspace,
    onSuccess: async (workspace) => {
      if (workspace) {
        setSavedWorkspaceNameDraft(workspace.name);
      }

      await Promise.all([
        queryClient.invalidateQueries({queryKey: cloudWorkspacesQueryKey}),
        queryClient.invalidateQueries({
          queryKey: ['cloudWorkspace', props.mode, props.workspaceId, token],
        }),
      ]);
    },
  });
  const saveWorkspaceLayoutMutation = useMutation({
    mutationFn: saveWorkspaceLayout,
  });
  const saveWorkspaceAiConfigMutation = useMutation({
    mutationFn: saveWorkspaceAiConfig,
  });

  const currentWorkspace =
    props.mode === 'saved' ? savedWorkspaceQuery.data : null;
  const worksheets = useMemo(() => {
    if (currentWorkspace?.worksheets.length) return currentWorkspace.worksheets;
    return localWorksheets;
  }, [currentWorkspace, localWorksheets]);
  const selectedWorksheet = useMemo(
    () =>
      worksheets.find((worksheet) => worksheet.id === selectedWorksheetId) ??
      worksheets[0],
    [selectedWorksheetId, worksheets],
  );
  const workspaceTableNames = useMemo(
    () =>
      Array.from(
        new Set([
          ...(workspaceFilesQuery.data ?? []).map((file) => file.tableName),
          ...duckDbRuntime.tableNames,
          ...preparedLocalFiles.map((file) => file.tableName),
        ]),
      ),
    [duckDbRuntime.tableNames, preparedLocalFiles, workspaceFilesQuery.data],
  );
  const fileBackedTableNames = useMemo(
    () =>
      new Set([
        ...(workspaceFilesQuery.data ?? []).map((file) => file.tableName),
        ...preparedLocalFiles.map((file) => file.tableName),
      ]),
    [preparedLocalFiles, workspaceFilesQuery.data],
  );
  const runtimeOnlyTableNames = useMemo(
    () =>
      duckDbRuntime.tableNames.filter(
        (tableName) => !fileBackedTableNames.has(tableName),
      ),
    [duckDbRuntime.tableNames, fileBackedTableNames],
  );
  const schemaTableItems = useMemo<SchemaTableItem[]>(
    () => [
      ...(workspaceFilesQuery.data ?? []).map((file) => ({
        key: `saved:${file.id}`,
        name: file.tableName,
        meta: formatBytes(file.sizeBytes),
      })),
      ...runtimeOnlyTableNames.map((tableName) => ({
        key: `runtime:${tableName}`,
        name: tableName,
        meta: 'In memory',
      })),
      ...preparedLocalFiles.map((file) => ({
        key: `prepared:${file.id}`,
        name: file.tableName,
        meta: formatBytes(file.parquetSizeBytes),
      })),
    ],
    [preparedLocalFiles, runtimeOnlyTableNames, workspaceFilesQuery.data],
  );
  const [tablePreview, setTablePreview] = useState<TablePreview | null>(null);

  useEffect(() => {
    if (!worksheets.length) return;
    if (
      selectedWorksheetId &&
      worksheets.some((worksheet) => worksheet.id === selectedWorksheetId)
    ) {
      return;
    }

    setSelectedWorksheetId(worksheets[0].id);
  }, [selectedWorksheetId, worksheets]);

  useEffect(() => {
    if (currentWorkspace?.name) {
      setSavedWorkspaceNameDraft(currentWorkspace.name);
    }
  }, [currentWorkspace?.name]);

  useEffect(() => {
    if (props.mode === 'saved') {
      setWorkspaceLayout(
        currentWorkspace?.layout
          ? (currentWorkspace.layout as unknown as LayoutNode)
          : createDefaultWorkspaceLayout(),
      );
      return;
    }

    setWorkspaceLayout(createDefaultWorkspaceLayout());
  }, [currentWorkspace?.id, currentWorkspace?.layout, props.mode]);

  useEffect(() => {
    if (props.mode === 'saved') {
      setWorkspaceAiConfig(
        currentWorkspace?.aiConfig ?? createDefaultWorkspaceAiConfig(),
      );
      return;
    }

    setWorkspaceAiConfig(createDefaultWorkspaceAiConfig());
  }, [currentWorkspace?.aiConfig, currentWorkspace?.id, props.mode]);

  useEffect(() => {
    if (
      props.mode !== 'saved' ||
      !savedWorkspaceId ||
      !token ||
      !duckDbRuntime.runtime ||
      !workspaceFilesQuery.data?.length
    ) {
      return;
    }

    let isCurrent = true;
    const runtime = duckDbRuntime.runtime;
    const loadedTables = new Set(duckDbRuntime.tableNames);

    Promise.all(
      workspaceFilesQuery.data
        .filter((file) => !loadedTables.has(file.tableName))
        .map((file) =>
          loadSavedWorkspaceFile({
            runtime,
            token,
            workspaceId: savedWorkspaceId,
            fileId: file.id,
            tableName: file.tableName,
          }),
        ),
    )
      .then(() => {
        if (isCurrent) return duckDbRuntime.refreshTables();
      })
      .catch((error: unknown) => {
        if (!isCurrent) return;
        setFileIngestionStatus(
          error instanceof Error
            ? error.message
            : 'Could not load saved files.',
        );
      });

    return () => {
      isCurrent = false;
    };
  }, [
    duckDbRuntime.refreshTables,
    duckDbRuntime.runtime,
    duckDbRuntime.tableNames,
    props.mode,
    savedWorkspaceId,
    token,
    workspaceFilesQuery.data,
  ]);

  const handleSignIn = async () => {
    const result = await authClient.signIn.social({
      provider: 'google',
      callbackURL: window.location.href,
    });
    if (result.error?.message) {
      window.alert(result.error.message);
    }
  };

  const handleSaveWorkspace = async () => {
    if (!token) {
      setIsSignInToSaveOpen(true);
      return;
    }

    const workspace = await createWorkspaceMutation.mutateAsync({
      data: {
        token,
        name: localWorkspaceName,
        layout: workspaceLayout as unknown as JsonObject,
        aiConfig: workspaceAiConfig,
        worksheetTitle: localWorksheets[0].title,
        worksheetContent: localWorksheets[0].content,
      },
    });

    for (const preparedFile of preparedLocalFiles) {
      await uploadPreparedWorkspaceFile({
        token,
        workspaceId: workspace.id,
        preparedFile,
      });
    }
    setPreparedLocalFiles([]);

    await queryClient.invalidateQueries({queryKey: cloudWorkspacesQueryKey});
    await navigate({
      to: '/workspaces/$workspaceId',
      params: {workspaceId: workspace.id},
    });
  };

  const handleWorkspaceTitleChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (props.mode === 'saved') {
      setSavedWorkspaceNameDraft(event.target.value);
      return;
    }

    setLocalWorkspaceName(event.target.value);
  };

  const handleWorkspaceTitleCommit = async () => {
    if (props.mode === 'unsaved') {
      setLocalWorkspaceName(localWorkspaceName.trim() || 'Untitled Workspace');
      return;
    }

    const currentName = currentWorkspace?.name;
    const nextName = savedWorkspaceNameDraft.trim();
    if (!token || !currentName || !nextName || nextName === currentName) {
      if (!nextName && currentName) {
        setSavedWorkspaceNameDraft(currentName);
      }
      return;
    }

    await renameWorkspaceMutation.mutateAsync({
      data: {
        token,
        workspaceId: props.workspaceId,
        name: nextName,
      },
    });
  };

  const handleWorkspaceTitleKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === 'Enter') {
      event.currentTarget.blur();
    }
  };

  const workspaceIdForLayoutSave =
    props.mode === 'saved' ? props.workspaceId : null;
  const handleWorkspaceLayoutChange = useCallback(
    (nextLayout: LayoutNode | null) => {
      const layout = nextLayout ?? createDefaultWorkspaceLayout();
      setWorkspaceLayout(layout);

      if (workspaceIdForLayoutSave && token) {
        saveWorkspaceLayoutMutation.mutate({
          data: {
            token,
            workspaceId: workspaceIdForLayoutSave,
            layout: layout as unknown as JsonObject,
          },
        });
      }
    },
    [saveWorkspaceLayoutMutation, token, workspaceIdForLayoutSave],
  );
  const handleWorkspaceAiConfigChange = useCallback((aiConfig: JsonObject) => {
    setWorkspaceAiConfig(aiConfig);
  }, []);

  useEffect(() => {
    if (!workspaceIdForLayoutSave || !token) return;

    const timeoutId = window.setTimeout(() => {
      saveWorkspaceAiConfigMutation.mutate({
        data: {
          token,
          workspaceId: workspaceIdForLayoutSave,
          aiConfig: workspaceAiConfig,
        },
      });
    }, 900);

    return () => window.clearTimeout(timeoutId);
  }, [
    saveWorkspaceAiConfigMutation,
    token,
    workspaceAiConfig,
    workspaceIdForLayoutSave,
  ]);

  const isAssistantPanelCollapsed = useMemo(
    () => isLayoutNodeCollapsed(workspaceLayout, ASSISTANT_PANEL_ID),
    [workspaceLayout],
  );

  const handleToggleAssistantPanel = () => {
    handleWorkspaceLayoutChange(
      setLayoutNodeCollapsed(
        workspaceLayout,
        ASSISTANT_PANEL_ID,
        !isAssistantPanelCollapsed,
      ),
    );
  };

  const handleAddFile = () => {
    if (!duckDbRuntime.runtime) {
      setFileIngestionStatus('Preparing runtime');
      return;
    }

    if (props.mode === 'saved' && !token) {
      setIsSignInToSaveOpen(true);
      return;
    }

    fileInputRef.current?.click();
  };

  const handlePreviewTable = async (tableName: string) => {
    if (!duckDbRuntime.runtime) return;

    setTablePreview({
      tableName,
      columns: [],
      rows: [],
      status: 'loading',
    });

    try {
      const rows = Array.from(
        await duckDbRuntime.runtime.connector.queryJson<
          Record<string, unknown>
        >(`select * from ${escapeIdentifier(tableName)} limit 25`),
      );
      setTablePreview({
        tableName,
        columns: Array.from(new Set(rows.flatMap((row) => Object.keys(row)))),
        rows,
        status: 'ready',
      });
    } catch (error) {
      setTablePreview({
        tableName,
        columns: [],
        rows: [],
        status: 'error',
        error:
          error instanceof Error ? error.message : 'Could not preview table.',
      });
    }
  };

  const handleFileInputChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!duckDbRuntime.runtime || files.length === 0) return;

    void ingestFiles(files);
  };

  const askFileNameConflict = ({
    fileName,
    tableName,
    existingNames,
  }: {
    fileName: string;
    tableName: string;
    existingNames: string[];
  }) =>
    new Promise<FileConflictResolution>((resolve) => {
      setFileNameConflict({
        fileName,
        tableName,
        uniqueTableName: generateUniqueName(tableName, existingNames),
        resolve,
      });
    });

  const resolveFileNameConflict = (resolution: FileConflictResolution) => {
    fileNameConflict?.resolve(resolution);
    setFileNameConflict(null);
  };

  const ingestFiles = async (files: File[]) => {
    if (!duckDbRuntime.runtime) return;

    setFileIngestionStatus('Loading file');
    try {
      const nextPreparedFiles: PreparedWorkspaceFile[] = [];
      for (const file of files) {
        let tableName = createTableName(file.name);
        let savedFilesToReplace: {id: string; tableName: string}[] = [];
        const existingTableNames = [
          ...workspaceTableNames,
          ...nextPreparedFiles.map((preparedFile) => preparedFile.tableName),
        ];

        if (hasTableName(existingTableNames, tableName)) {
          const resolution = await askFileNameConflict({
            fileName: file.name,
            tableName,
            existingNames: existingTableNames,
          });

          if (resolution.action === 'cancel') {
            continue;
          }

          if (resolution.action === 'keep-both') {
            tableName = resolution.tableName;
          } else {
            await dropWorkspaceTable({
              runtime: duckDbRuntime.runtime,
              tableName,
            });
            removePreparedFilesByTableName(nextPreparedFiles, tableName);
            setPreparedLocalFiles((currentFiles) =>
              currentFiles.filter(
                (currentFile) => currentFile.tableName !== tableName,
              ),
            );

            if (props.mode === 'saved' && token) {
              savedFilesToReplace = (workspaceFilesQuery.data ?? []).filter(
                (workspaceFile) => workspaceFile.tableName === tableName,
              );
            }
          }
        }

        const preparedFile = await prepareWorkspaceFile({
          runtime: duckDbRuntime.runtime,
          file,
          tableName,
        });
        nextPreparedFiles.push(preparedFile);

        if (props.mode === 'saved' && token) {
          for (const workspaceFile of savedFilesToReplace) {
            await deleteWorkspaceFile({
              data: {
                token,
                workspaceId: props.workspaceId,
                fileId: workspaceFile.id,
              },
            });
          }

          await uploadPreparedWorkspaceFile({
            token,
            workspaceId: props.workspaceId,
            preparedFile,
          });
          await queryClient.invalidateQueries({
            queryKey: ['workspaceFiles', props.mode, props.workspaceId, token],
          });
        }
      }

      if (props.mode === 'unsaved' || !token) {
        setPreparedLocalFiles((currentFiles) => [
          ...currentFiles,
          ...nextPreparedFiles,
        ]);
      }
      await duckDbRuntime.refreshTables();
      if (props.mode === 'saved' && token) {
        await queryClient.invalidateQueries({
          queryKey: ['workspaceFiles', props.mode, props.workspaceId, token],
        });
      }
      setFileIngestionStatus(null);
    } catch (error) {
      setFileIngestionStatus(
        error instanceof Error ? error.message : 'Could not add file.',
      );
    }
  };

  const workspaceTitle =
    props.mode === 'saved'
      ? savedWorkspaceNameDraft ||
        currentWorkspace?.name ||
        'Loading workspace...'
      : localWorkspaceName;

  return (
    <main className="dark app-background sqlrooms-web-root">
      <TooltipProvider>
        <SidebarProvider defaultOpen>
          <Sidebar collapsible="icon" className="sqlrooms-sidebar">
            <SidebarHeader className="gap-3">
              <SidebarBrand />
              <WorkspaceDropdown
                workspaceTitle={workspaceTitle}
                workspaces={workspacesQuery.data ?? []}
              />
            </SidebarHeader>

            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel className="text-shell-subtle">
                  Data
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <DatabaseSidebarSection
                    tables={schemaTableItems}
                    status={fileIngestionStatus}
                    runtimeStatus={duckDbRuntime.status}
                    onAddFile={handleAddFile}
                    onPreviewTable={(tableName) =>
                      void handlePreviewTable(tableName)
                    }
                  />
                  <input
                    ref={fileInputRef}
                    className="sr-only"
                    type="file"
                    multiple
                    onChange={handleFileInputChange}
                    tabIndex={-1}
                  />
                </SidebarGroupContent>
              </SidebarGroup>

              <SidebarGroup>
                <SidebarGroupLabel className="text-shell-subtle">
                  Worksheets
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <WorksheetsSidebarSection
                    worksheets={worksheets}
                    selectedWorksheetId={selectedWorksheet?.id}
                    onSelectWorksheet={setSelectedWorksheetId}
                  />
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>

            <SidebarFooter>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() =>
                      session?.user
                        ? void authClient.signOut()
                        : void handleSignIn()
                    }
                  >
                    {session?.user ? (
                      <LogOut className="size-4" aria-hidden />
                    ) : (
                      <LogIn className="size-4" aria-hidden />
                    )}
                    <span>{session?.user ? 'Sign out' : 'Sign in'}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarFooter>
            <SidebarRail />
          </Sidebar>

          <SidebarInset className="sqlrooms-workspace">
            <header className="workspace-topbar">
              <div className="topbar-left">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SidebarTrigger className="topbar-icon" />
                  </TooltipTrigger>
                  <TooltipContent>Toggle sidebar</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="topbar-icon"
                      type="button"
                      aria-pressed={!isAssistantPanelCollapsed}
                      onClick={handleToggleAssistantPanel}
                    >
                      <Sparkles className="size-4" aria-hidden />
                      <span className="sr-only">
                        {isAssistantPanelCollapsed
                          ? 'Show assistant'
                          : 'Hide assistant'}
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isAssistantPanelCollapsed
                      ? 'Show assistant'
                      : 'Hide assistant'}
                  </TooltipContent>
                </Tooltip>
                <div className="topbar-divider" />
                <Input
                  id="workspace-title"
                  name="workspaceTitle"
                  className="workspace-title-input"
                  value={workspaceTitle}
                  disabled={
                    props.mode === 'saved' &&
                    (!currentWorkspace || renameWorkspaceMutation.isPending)
                  }
                  onBlur={() => void handleWorkspaceTitleCommit()}
                  onChange={handleWorkspaceTitleChange}
                  onKeyDown={handleWorkspaceTitleKeyDown}
                  aria-label="Workspace title"
                />
              </div>
              <div className="topbar-right">
                {props.mode === 'unsaved' ? (
                  <Button
                    className="save-workspace-button"
                    type="button"
                    onClick={() => void handleSaveWorkspace()}
                    disabled={createWorkspaceMutation.isPending}
                  >
                    <Save className="size-4" aria-hidden />
                    Save Workspace
                  </Button>
                ) : null}
                <Button variant="ghost" size="icon" className="topbar-icon">
                  <Settings className="size-4" aria-hidden />
                  <span className="sr-only">Settings</span>
                </Button>
              </div>
            </header>

            <WorkspaceLayoutCanvas
              workspaceKey={activeWorkspaceId}
              layout={workspaceLayout}
              aiConfig={workspaceAiConfig}
              selectedWorksheet={selectedWorksheet}
              token={token}
              savedWorkspaceId={savedWorkspaceId}
              duckDbRuntime={duckDbRuntime}
              onLayoutChange={handleWorkspaceLayoutChange}
              onAiConfigChange={handleWorkspaceAiConfigChange}
            />
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>

      <Dialog open={isSignInToSaveOpen} onOpenChange={setIsSignInToSaveOpen}>
        <DialogContent className="sign-in-dialog">
          <DialogHeader className="sign-in-dialog-header">
            <DialogTitle className="sign-in-dialog-title">
              Sign in to save
            </DialogTitle>
            <DialogDescription className="sign-in-dialog-description">
              Save this workspace to your account and keep working from any
              browser.
            </DialogDescription>
          </DialogHeader>
          <Button
            className="google-sign-in-button"
            type="button"
            onClick={() => void handleSignIn()}
          >
            Continue with Google
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(tablePreview)}
        onOpenChange={(open) => {
          if (!open) setTablePreview(null);
        }}
      >
        <DialogContent className="table-preview-dialog">
          <DialogHeader>
            <DialogTitle>{tablePreview?.tableName ?? 'Table'}</DialogTitle>
            <DialogDescription>Preview of the first 25 rows.</DialogDescription>
          </DialogHeader>
          <div className="table-preview-body">
            {tablePreview?.status === 'loading' ? (
              <div className="table-preview-empty">Loading preview</div>
            ) : null}
            {tablePreview?.status === 'error' ? (
              <div className="table-preview-empty">{tablePreview.error}</div>
            ) : null}
            {tablePreview?.status === 'ready' &&
            tablePreview.rows.length === 0 ? (
              <div className="table-preview-empty">No rows</div>
            ) : null}
            {tablePreview?.status === 'ready' &&
            tablePreview.rows.length > 0 ? (
              <table className="table-preview-grid">
                <thead>
                  <tr>
                    {tablePreview.columns.map((column) => (
                      <th key={column}>{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tablePreview.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {tablePreview.columns.map((column) => (
                        <td key={column}>{formatPreviewCell(row[column])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setTablePreview(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(fileNameConflict)}
        onOpenChange={(open) => {
          if (!open && fileNameConflict) {
            resolveFileNameConflict({action: 'cancel'});
          }
        }}
      >
        <DialogContent className="file-conflict-dialog">
          <DialogHeader className="sign-in-dialog-header">
            <DialogTitle className="sign-in-dialog-title">
              Table already exists
            </DialogTitle>
            <DialogDescription className="sign-in-dialog-description">
              {fileNameConflict
                ? `"${fileNameConflict.tableName}" already exists. How should SQLRooms add "${fileNameConflict.fileName}"?`
                : null}
            </DialogDescription>
          </DialogHeader>
          {fileNameConflict ? (
            <p className="file-conflict-detail">
              Keeping both will add the new table as "
              {fileNameConflict.uniqueTableName}".
            </p>
          ) : null}
          <div className="file-conflict-actions">
            <Button
              variant="ghost"
              type="button"
              onClick={() => resolveFileNameConflict({action: 'cancel'})}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              type="button"
              onClick={() =>
                fileNameConflict
                  ? resolveFileNameConflict({
                      action: 'keep-both',
                      tableName: fileNameConflict.uniqueTableName,
                    })
                  : undefined
              }
            >
              Keep both
            </Button>
            <Button
              type="button"
              onClick={() => resolveFileNameConflict({action: 'replace'})}
            >
              Replace
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function WorkspaceLayoutCanvas({
  workspaceKey,
  layout,
  aiConfig,
  selectedWorksheet,
  token,
  savedWorkspaceId,
  duckDbRuntime,
  onLayoutChange,
  onAiConfigChange,
}: {
  workspaceKey: string;
  layout: LayoutNode;
  aiConfig: JsonObject;
  selectedWorksheet: LocalWorksheet | undefined;
  token: string | null;
  savedWorkspaceId: string | null;
  duckDbRuntime: ReturnType<typeof useWorkspaceDuckDbRuntime>;
  onLayoutChange: (layout: LayoutNode | null) => void;
  onAiConfigChange: (aiConfig: JsonObject) => void;
}) {
  const panels = useMemo<Panels>(
    () => ({
      assistant: {
        title: 'Assistant',
        icon: Sparkles,
        component: function WorkspaceAssistantPanel() {
          return (
            <AssistantPanel
              worksheetId={selectedWorksheet?.id}
              worksheetTitle={selectedWorksheet?.title}
            />
          );
        },
      },
      worksheet: {
        title: selectedWorksheet?.title ?? 'Worksheet',
        icon: FileSpreadsheet,
        component: function WorkspaceWorksheetPanel() {
          return (
            <section className="worksheet-panel">
              <div className="worksheet-stage">
                {selectedWorksheet ? (
                  <WorksheetSurface
                    worksheet={selectedWorksheet}
                    token={token}
                    workspaceId={savedWorkspaceId}
                    duckDbRuntime={duckDbRuntime}
                  />
                ) : null}
              </div>
            </section>
          );
        },
      },
    }),
    [duckDbRuntime, savedWorkspaceId, selectedWorksheet],
  );
  const initialLayoutRef = useRef(layout);
  const initialPanelsRef = useRef(panels);
  const initialAiConfigRef = useRef(aiConfig);
  const syncedAiConfigJsonRef = useRef(getAiConfigSyncKey(aiConfig));
  const roomStore = useMemo(
    () =>
      createWorkspaceStore(
        workspaceKey,
        initialLayoutRef.current,
        initialAiConfigRef.current,
        initialPanelsRef.current,
        token,
      ),
    [workspaceKey],
  );

  useEffect(() => {
    roomStore.getState().layout.setConfig(layout);
  }, [layout, roomStore]);

  useEffect(() => {
    const nextAiConfigJson = getAiConfigSyncKey(aiConfig);
    if (nextAiConfigJson === syncedAiConfigJsonRef.current) return;

    syncedAiConfigJsonRef.current = nextAiConfigJson;
    roomStore.getState().ai.setConfig(parseWorkspaceAiConfig(aiConfig));
  }, [aiConfig, roomStore]);

  useEffect(() => {
    roomStore.setState((state) => ({
      ...state,
      ai: {
        ...state.ai,
        chatHeaders: createAssistantChatHeaders(token),
      },
    }));
  }, [roomStore, token]);

  useEffect(() => {
    for (const [panelId, panel] of Object.entries(panels)) {
      roomStore.getState().layout.registerPanel(panelId, panel);
    }
  }, [panels, roomStore]);

  useEffect(() => {
    return roomStore.subscribe((state, previousState) => {
      if (state.ai.config !== previousState.ai.config) {
        const nextAiConfigJson = getAiConfigSyncKey(state.ai.config);
        if (nextAiConfigJson === syncedAiConfigJsonRef.current) return;

        syncedAiConfigJsonRef.current = nextAiConfigJson;
        onAiConfigChange(state.ai.config as unknown as JsonObject);
      }
    });
  }, [onAiConfigChange, roomStore]);

  const handleCollapse = useCallback(
    (panelId: string) => {
      onLayoutChange(setLayoutNodeCollapsed(layout, panelId, true));
    },
    [layout, onLayoutChange],
  );
  const handleExpand = useCallback(
    (panelId: string) => {
      onLayoutChange(setLayoutNodeCollapsed(layout, panelId, false));
    },
    [layout, onLayoutChange],
  );

  return (
    <RoomStateProvider roomStore={roomStore}>
      <div className="workspace-panels">
        <LayoutRenderer
          className="workspace-layout-renderer"
          rootLayout={layout}
          onLayoutChange={onLayoutChange}
          onCollapse={handleCollapse}
          onExpand={handleExpand}
        />
      </div>
    </RoomStateProvider>
  );
}

function createWorkspaceStore(
  workspaceKey: string,
  layout: LayoutNode,
  aiConfig: JsonObject,
  panels: Panels,
  token: string | null,
): StoreApi<WorkspaceRoomState> {
  const {createRoomStore} = createRoomStoreCreator<WorkspaceRoomState>()(
    () => (set, get, store) => ({
      ...createBaseRoomSlice()(set, get, store),
      ...createLayoutSlice({config: layout, panels})(set, get, store),
      ...createAiSlice({
        config: parseWorkspaceAiConfig(aiConfig),
        tools: {},
        defaultProvider: 'openrouter',
        defaultModel: 'openai/gpt-4o-mini',
        getAvailableModels: () => [
          {provider: 'openrouter', value: 'openai/gpt-4o-mini'},
        ],
        chatEndPoint: '/api/chat',
        chatHeaders: createAssistantChatHeaders(token),
        getInstructions: (args) =>
          createAssistantInstructions(args?.runContext),
      })(set, get, store),
    }),
  );

  return createRoomStore({storeKey: `web-workspace-layout:${workspaceKey}`});
}

function parseWorkspaceAiConfig(aiConfig: JsonObject) {
  return AiSliceConfig.parse(aiConfig);
}

function getAiConfigSyncKey(aiConfig: unknown) {
  const parsedConfig = AiSliceConfig.safeParse(aiConfig);
  if (!parsedConfig.success) return JSON.stringify(aiConfig);

  return JSON.stringify({
    ...parsedConfig.data,
    sessions: parsedConfig.data.sessions.map((session) => ({
      ...session,
      prompt: '',
    })),
  });
}

function createAssistantChatHeaders(
  token: string | null,
): Record<string, string> {
  return token ? {Authorization: `Bearer ${token}`} : {};
}

function createAssistantInstructions(runContext: unknown) {
  const context =
    runContext && typeof runContext === 'object' && 'items' in runContext
      ? (runContext as {
          items?: Array<{kind?: string; id?: string; title?: string}>;
        })
      : undefined;
  const worksheet = context?.items?.find((item) => item.kind === 'worksheet');

  return `You are the SQLRooms assistant for a browser-based data analysis workspace.
Help the user reason about datasets, write SQL, plan worksheets, and design charts or dashboards.
Be concise, practical, and explicit about assumptions. Do not claim to inspect data unless the user has provided it in the chat.

Primary worksheet: ${worksheet?.title ?? 'Unknown worksheet'}`;
}

function isLayoutNodeCollapsed(node: LayoutNode, nodeId: string): boolean {
  if (typeof node === 'string') return false;
  if (node.id === nodeId) return node.collapsed === true;

  if ('children' in node) {
    return node.children.some((child) => isLayoutNodeCollapsed(child, nodeId));
  }

  if ('root' in node) {
    return isLayoutNodeCollapsed(node.root, nodeId);
  }

  return false;
}

function setLayoutNodeCollapsed(
  node: LayoutNode,
  nodeId: string,
  collapsed: boolean,
): LayoutNode {
  if (typeof node === 'string') return node;

  if (node.id === nodeId) {
    return {...node, collapsed};
  }

  if ('children' in node) {
    return {
      ...node,
      children: node.children.map((child) =>
        setLayoutNodeCollapsed(child, nodeId, collapsed),
      ),
    };
  }

  if ('root' in node) {
    return {
      ...node,
      root: setLayoutNodeCollapsed(node.root, nodeId, collapsed),
    };
  }

  return node;
}

function hasTableName(tableNames: string[], tableName: string) {
  return tableNames.some(
    (existingTableName) =>
      existingTableName.toLowerCase() === tableName.toLowerCase(),
  );
}

function SidebarBrand() {
  const {setOpen} = useSidebar();

  return (
    <button
      className="brand-button"
      type="button"
      onClick={() => setOpen(true)}
      aria-label="Open sidebar"
    >
      <img className="brand-logo" src="/logo.png" alt="" />
      <div className="brand-copy">
        <div className="brand-title">SQLRooms</div>
        <div className="brand-subtitle">Analytics workspaces</div>
      </div>
    </button>
  );
}

function WorkspaceDropdown({
  workspaceTitle,
  workspaces,
}: {
  workspaceTitle: string;
  workspaces: Array<{id: string; name: string}>;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          className="workspace-selector"
          type="button"
          size="lg"
          tooltip="Workspaces"
        >
          <FolderKanban className="size-4" aria-hidden />
          <span className="truncate">{workspaceTitle}</span>
          <ChevronDown
            className="workspace-selector-chevron ml-auto size-4"
            aria-hidden
          />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="workspace-menu"
        align="start"
        side="right"
      >
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        {workspaces.map((workspace) => (
          <DropdownMenuItem key={workspace.id} asChild>
            <Link
              to="/workspaces/$workspaceId"
              params={{workspaceId: workspace.id}}
            >
              <FolderKanban className="size-4" aria-hidden />
              {workspace.name}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/">
            <Plus className="size-4" aria-hidden />
            New Workspace
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DatabaseSidebarSection({
  tables,
  status,
  runtimeStatus,
  onAddFile,
  onPreviewTable,
}: {
  tables: SchemaTableItem[];
  status: string | null;
  runtimeStatus: string;
  onAddFile: () => void;
  onPreviewTable: (tableName: string) => void;
}) {
  const {state} = useSidebar();

  if (state === 'expanded') {
    return (
      <div className="sidebar-inline-panel">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="add-file-button"
              onClick={onAddFile}
              type="button"
            >
              <UploadCloud className="size-4" aria-hidden />
              <span>Add file</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="schema-tree">
          <div className="schema-node">
            <Database className="size-4" aria-hidden />
            <span>main</span>
          </div>
          {tables.map((table) => (
            <button
              className="schema-table"
              key={table.key}
              type="button"
              onClick={() => onPreviewTable(table.name)}
            >
              <Table2 className="size-4" aria-hidden />
              <div className="min-w-0">
                <div className="schema-table-name">{table.name}</div>
                <div className="schema-table-meta">{table.meta}</div>
              </div>
              <Eye className="schema-table-preview-icon size-3.5" aria-hidden />
            </button>
          ))}
          {tables.length === 0 ? (
            <div className="schema-empty">
              {runtimeStatus === 'initializing'
                ? 'Preparing runtime'
                : 'No tables'}
            </div>
          ) : null}
          {status ? <div className="schema-empty">{status}</div> : null}
        </div>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          className="sidebar-nav-button"
          type="button"
          size="lg"
          tooltip="Database"
        >
          <Database className="size-4" aria-hidden />
          <span>Database</span>
          <ChevronDown className="sidebar-nav-chevron ml-auto size-4" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="workspace-menu"
        align="start"
        side="right"
      >
        <DropdownMenuLabel>Tables</DropdownMenuLabel>
        {tables.map((table) => (
          <DropdownMenuItem
            key={table.key}
            onClick={() => onPreviewTable(table.name)}
          >
            <Table2 className="size-4" aria-hidden />
            <div className="dropdown-table-item">
              <span>{table.name}</span>
              <small>{table.meta}</small>
            </div>
            <Eye className="ml-auto size-3.5" aria-hidden />
          </DropdownMenuItem>
        ))}
        {tables.length === 0 ? (
          <DropdownMenuItem disabled>
            {runtimeStatus === 'initializing'
              ? 'Preparing runtime'
              : 'No tables'}
          </DropdownMenuItem>
        ) : null}
        {status ? <DropdownMenuItem disabled>{status}</DropdownMenuItem> : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onAddFile}>
          <UploadCloud className="size-4" aria-hidden />
          Add table
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function WorksheetsSidebarSection({
  worksheets,
  selectedWorksheetId,
  onSelectWorksheet,
}: {
  worksheets: LocalWorksheet[];
  selectedWorksheetId: string | undefined;
  onSelectWorksheet: (worksheetId: string) => void;
}) {
  const activeWorksheet = worksheets.find(
    (worksheet) => worksheet.id === selectedWorksheetId,
  );
  const {state} = useSidebar();

  if (state === 'expanded') {
    return (
      <SidebarMenu>
        {worksheets.map((worksheet) => (
          <SidebarMenuItem key={worksheet.id}>
            <SidebarMenuButton
              isActive={worksheet.id === selectedWorksheetId}
              onClick={() => onSelectWorksheet(worksheet.id)}
              type="button"
            >
              <FileSpreadsheet className="size-4" aria-hidden />
              <span>{worksheet.title}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
        <SidebarMenuItem>
          <SidebarMenuButton type="button">
            <Plus className="size-4" aria-hidden />
            <span>New Worksheet</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          className="sidebar-nav-button"
          type="button"
          size="lg"
          tooltip="Worksheets"
          isActive
        >
          <FileSpreadsheet className="size-4" aria-hidden />
          <span>{activeWorksheet?.title ?? 'Worksheets'}</span>
          <ChevronDown className="sidebar-nav-chevron ml-auto size-4" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="workspace-menu"
        align="start"
        side="right"
      >
        <DropdownMenuLabel>Worksheets</DropdownMenuLabel>
        {worksheets.map((worksheet) => (
          <DropdownMenuItem
            key={worksheet.id}
            onClick={() => onSelectWorksheet(worksheet.id)}
          >
            <FileSpreadsheet className="size-4" aria-hidden />
            {worksheet.title}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Plus className="size-4" aria-hidden />
          New Worksheet
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function removePreparedFilesByTableName(
  files: PreparedWorkspaceFile[],
  tableName: string,
) {
  for (let index = files.length - 1; index >= 0; index -= 1) {
    if (files[index].tableName === tableName) {
      files.splice(index, 1);
    }
  }
}

function escapeIdentifier(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function formatPreviewCell(value: unknown) {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'] as const;
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}
