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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  useSidebar,
} from '@sqlrooms/ui';
import type {LayoutNode} from '@sqlrooms/layout';
import type {StoreApi} from '@sqlrooms/room-store';
import {
  ChevronDown,
  FolderKanban,
  LogIn,
  LogOut,
  Plus,
  Save,
  Settings,
} from 'lucide-react';
import type React from 'react';
import {useEffect, useMemo, useState} from 'react';
import {authClient, getNeonJWTToken} from '#/lib/auth-client';
import type {JsonObject} from '#/lib/json';
import {WorkspaceFileDialogs} from './files/WorkspaceFileDialogs';
import {useWorkspaceFileWorkflow} from './files/useWorkspaceFileWorkflow';
import {listWorkspaceFiles} from './workspace/files';
import {createDefaultWorkspaceContent} from './workspace/workspaceContent';
import {
  createDefaultWorkspaceAiConfig,
  createDefaultWorkspaceLayout,
  createWorkspaceRoomSnapshot,
  type WorkspaceRoomState,
} from './workspace/WorkspaceRoomStore';
import {
  WorkspaceAssistantPanelToggle,
  WorkspaceLayoutSurface,
} from './workspace/WorkspaceLayoutSurface';
import {type SaveWorkspaceRoomSnapshot} from './workspace/WorkspaceRoomProvider';
import {useWorkspaceRoomSnapshot} from './workspace/useWorkspaceRoomSnapshot';
import {
  DatabaseSidebarSection,
  WorksheetsSidebarSection,
} from './workspace/WorkspaceSidebarSections';
import {
  createCloudWorkspace,
  getCloudWorkspace,
  listCloudWorkspaces,
  renameCloudWorkspace,
  saveWorkspaceSnapshot,
} from './workspace/cloudWorkspaces';
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

const cloudWorkspacesQueryKey = ['cloudWorkspaces'] as const;

export function WorkspaceShell(props: WorkspaceShellProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {data: session} = authClient.useSession();
  const [localWorkspaceName, setLocalWorkspaceName] =
    useState('Untitled Workspace');
  const [savedWorkspaceNameDraft, setSavedWorkspaceNameDraft] = useState('');
  const [isSignInToSaveOpen, setIsSignInToSaveOpen] = useState(false);
  const [workspaceRoomStore, setWorkspaceRoomStore] =
    useState<StoreApi<WorkspaceRoomState> | null>(null);
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
  const workspaceFilesQueryKey = [
    'workspaceFiles',
    props.mode,
    savedWorkspaceId,
    token,
  ] as const;

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
    queryKey: workspaceFilesQueryKey,
    queryFn: () =>
      listWorkspaceFiles({
        data: {token: token!, workspaceId: savedWorkspaceId!},
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
  const {workspaceContentSnapshot, worksheets, selectedWorksheetId} =
    useWorkspaceRoomSnapshot({
      roomStore: workspaceRoomStore,
      workspaceContent: currentWorkspace?.content,
    });
  const canPersistWorkspace = Boolean(currentWorkspace);
  const saveWorkspaceRoomSnapshot =
    useMemo<SaveWorkspaceRoomSnapshot | null>(() => {
      if (props.mode !== 'saved' || !token || !canPersistWorkspace) return null;

      return async (snapshot) => {
        await saveWorkspaceSnapshot({
          data: {
            token,
            workspaceId: props.workspaceId,
            content: snapshot.content,
            layout: snapshot.layout as unknown as JsonObject,
            aiConfig: snapshot.aiConfig,
          },
        });
      };
    }, [canPersistWorkspace, props.mode, props.workspaceId, token]);
  const selectedWorksheet = useMemo(
    () =>
      worksheets.find((worksheet) => worksheet.id === selectedWorksheetId) ??
      worksheets[0],
    [selectedWorksheetId, worksheets],
  );
  const fileWorkflow = useWorkspaceFileWorkflow({
    mode: props.mode,
    workspaceId: savedWorkspaceId,
    token,
    duckDbRuntime,
    workspaceFiles: workspaceFilesQuery.data,
    invalidateWorkspaceFiles: () =>
      queryClient.invalidateQueries({queryKey: workspaceFilesQueryKey}),
    openSignInToSave: () => setIsSignInToSaveOpen(true),
  });

  useEffect(() => {
    if (currentWorkspace?.name) {
      setSavedWorkspaceNameDraft(currentWorkspace.name);
    }
  }, [currentWorkspace?.name]);

  const initialWorkspaceLayout = useMemo(
    () =>
      props.mode === 'saved' && currentWorkspace?.layout
        ? (currentWorkspace.layout as unknown as LayoutNode)
        : createDefaultWorkspaceLayout(),
    [currentWorkspace?.layout, props.mode],
  );

  const initialWorkspaceAiConfig = useMemo(
    () =>
      props.mode === 'saved'
        ? (currentWorkspace?.aiConfig ?? createDefaultWorkspaceAiConfig())
        : createDefaultWorkspaceAiConfig(),
    [currentWorkspace?.aiConfig, props.mode],
  );

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
    const roomSnapshot = workspaceRoomStore
      ? createWorkspaceRoomSnapshot(workspaceRoomStore.getState())
      : null;

    const workspace = await createWorkspaceMutation.mutateAsync({
      data: {
        token,
        name: localWorkspaceName,
        content:
          roomSnapshot?.content ??
          workspaceContentSnapshot ??
          (createDefaultWorkspaceContent() as JsonObject),
        layout: (roomSnapshot?.layout ??
          initialWorkspaceLayout) as unknown as JsonObject,
        aiConfig: roomSnapshot?.aiConfig ?? initialWorkspaceAiConfig,
      },
    });

    await fileWorkflow.uploadPreparedLocalFiles({
      uploadToken: token,
      targetWorkspaceId: workspace.id,
    });

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
                    tables={fileWorkflow.schemaTableItems}
                    status={fileWorkflow.fileIngestionStatus}
                    runtimeStatus={duckDbRuntime.status}
                    onAddFile={fileWorkflow.addFile}
                    onPreviewTable={(tableName) =>
                      void fileWorkflow.previewTable(tableName)
                    }
                  />
                  <input
                    ref={fileWorkflow.fileInputRef}
                    className="sr-only"
                    type="file"
                    multiple
                    onChange={fileWorkflow.handleFileInputChange}
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
                    onSelectWorksheet={(worksheetId) =>
                      workspaceRoomStore
                        ?.getState()
                        .workspace.setCurrentWorksheet(worksheetId)
                    }
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
                <WorkspaceAssistantPanelToggle roomStore={workspaceRoomStore} />
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

            <WorkspaceLayoutSurface
              workspaceKey={activeWorkspaceId}
              layout={initialWorkspaceLayout}
              aiConfig={initialWorkspaceAiConfig}
              workspaceContent={currentWorkspace?.content}
              selectedWorksheet={selectedWorksheet}
              token={token}
              duckDbRuntime={duckDbRuntime}
              onRoomStoreChange={setWorkspaceRoomStore}
              saveRoomSnapshot={saveWorkspaceRoomSnapshot}
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

      <WorkspaceFileDialogs
        tablePreview={fileWorkflow.tablePreview}
        fileNameConflict={fileWorkflow.fileNameConflict}
        onCloseTablePreview={fileWorkflow.closeTablePreview}
        onResolveFileNameConflict={fileWorkflow.resolveFileNameConflict}
      />
    </main>
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
