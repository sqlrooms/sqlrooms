import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {Link, useNavigate} from '@tanstack/react-router';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
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
  TooltipProvider,
} from '@sqlrooms/ui';
import {generateUniqueName} from '@sqlrooms/utils';
import {
  ChevronDown,
  Database,
  FileSpreadsheet,
  FolderKanban,
  LogIn,
  LogOut,
  Plus,
  Save,
  Settings,
  UploadCloud,
  Table2,
} from 'lucide-react';
import type React from 'react';
import {useEffect, useMemo, useRef, useState} from 'react';
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

const cloudWorkspacesQueryKey = ['cloudWorkspaces'] as const;

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

  const currentWorkspace =
    props.mode === 'saved' ? savedWorkspaceQuery.data : null;
  const worksheets = useMemo(() => {
    if (currentWorkspace?.worksheets.length) return currentWorkspace.worksheets;
    return localWorksheets;
  }, [currentWorkspace, localWorksheets]);
  const selectedWorksheet = worksheets[0];
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
  const worksheetTitles = useMemo(
    () => worksheets.map((worksheet) => worksheet.title),
    [worksheets],
  );

  useEffect(() => {
    if (currentWorkspace?.name) {
      setSavedWorkspaceNameDraft(currentWorkspace.name);
    }
  }, [currentWorkspace?.name]);

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
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton className="brand-button h-auto gap-3 py-2">
                    <img className="brand-logo" src="/logo.png" alt="" />
                    <div className="min-w-0 text-left">
                      <div className="truncate text-sm font-semibold">
                        SQLRooms
                      </div>
                      <div className="text-shell-subtle truncate text-xs">
                        {props.mode === 'saved' ? 'Saved' : 'Unsaved'}
                      </div>
                    </div>
                    <ChevronDown className="text-shell-subtle ml-auto size-4" />
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    className="workspace-selector group-data-[collapsible=icon]:hidden"
                    type="button"
                    variant="ghost"
                  >
                    <FolderKanban className="size-4" aria-hidden />
                    <span className="truncate">{workspaceTitle}</span>
                    <ChevronDown className="ml-auto size-4" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="workspace-menu" align="start">
                  <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
                  {(workspacesQuery.data ?? []).map((workspace) => (
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
            </SidebarHeader>

            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel className="text-shell-subtle">
                  Data
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        className="add-file-button"
                        onClick={() => void handleAddFile()}
                      >
                        <UploadCloud className="size-4" aria-hidden />
                        <span>Add file</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                  <input
                    ref={fileInputRef}
                    className="sr-only"
                    type="file"
                    multiple
                    onChange={handleFileInputChange}
                    tabIndex={-1}
                  />
                  <div className="schema-tree group-data-[collapsible=icon]:hidden">
                    <div className="schema-node">
                      <Database className="size-4" aria-hidden />
                      <span>main</span>
                    </div>
                    {(workspaceFilesQuery.data ?? []).map((file) => (
                      <div className="schema-table" key={file.id}>
                        <Table2 className="size-4" aria-hidden />
                        <div className="min-w-0">
                          <div className="schema-table-name">
                            {file.tableName}
                          </div>
                          <div className="schema-table-meta">
                            {formatBytes(file.sizeBytes)}
                          </div>
                        </div>
                      </div>
                    ))}
                    {runtimeOnlyTableNames.map((tableName) => (
                      <div
                        className="schema-table"
                        key={`runtime:${tableName}`}
                      >
                        <Table2 className="size-4" aria-hidden />
                        <div className="min-w-0">
                          <div className="schema-table-name">{tableName}</div>
                          <div className="schema-table-meta">In memory</div>
                        </div>
                      </div>
                    ))}
                    {preparedLocalFiles.map((file) => (
                      <div className="schema-table" key={file.id}>
                        <Table2 className="size-4" aria-hidden />
                        <div className="min-w-0">
                          <div className="schema-table-name">
                            {file.tableName}
                          </div>
                          <div className="schema-table-meta">
                            {formatBytes(file.parquetSizeBytes)}
                          </div>
                        </div>
                      </div>
                    ))}
                    {!workspaceFilesQuery.data?.length &&
                    runtimeOnlyTableNames.length === 0 &&
                    preparedLocalFiles.length === 0 ? (
                      <div className="schema-empty">
                        {duckDbRuntime.status === 'initializing'
                          ? 'Preparing runtime'
                          : 'No tables'}
                      </div>
                    ) : null}
                    {fileIngestionStatus ? (
                      <div className="schema-empty">{fileIngestionStatus}</div>
                    ) : null}
                  </div>
                </SidebarGroupContent>
              </SidebarGroup>

              <SidebarGroup>
                <SidebarGroupLabel className="text-shell-subtle">
                  Workspace Items
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {worksheets.map((worksheet) => (
                      <SidebarMenuItem key={worksheet.id}>
                        <SidebarMenuButton isActive>
                          <FileSpreadsheet className="size-4" aria-hidden />
                          <span>{worksheet.title}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                    <SidebarMenuItem>
                      <SidebarMenuButton>
                        <Plus className="size-4" aria-hidden />
                        <span>New Worksheet</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
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
                <SidebarTrigger className="topbar-icon" />
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

            <div className="workspace-panels">
              <section className="worksheet-panel">
                <div className="artifact-tab-strip">
                  <button className="artifact-tab active" type="button">
                    <FileSpreadsheet className="size-4" aria-hidden />
                    {selectedWorksheet?.title ?? 'Worksheet'}
                  </button>
                  <button
                    className="artifact-tab-add"
                    type="button"
                    aria-label="New worksheet"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>

                <div className="worksheet-stage">
                  {selectedWorksheet ? (
                    <WorksheetSurface
                      worksheet={selectedWorksheet}
                      token={token}
                      workspaceId={savedWorkspaceId}
                    />
                  ) : null}
                </div>
              </section>

              <AssistantPanel
                token={token}
                workspaceTitle={workspaceTitle}
                worksheetTitles={worksheetTitles}
                tableNames={workspaceTableNames}
                onSignInRequired={() => setIsSignInToSaveOpen(true)}
              />
            </div>
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
              {fileNameConflict
                ? `Keep both (${fileNameConflict.uniqueTableName})`
                : 'Keep both'}
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

function hasTableName(tableNames: string[], tableName: string) {
  return tableNames.some(
    (existingTableName) =>
      existingTableName.toLowerCase() === tableName.toLowerCase(),
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
