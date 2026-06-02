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
import {
  BarChart3,
  Bot,
  ChevronDown,
  Database,
  FileSpreadsheet,
  FolderKanban,
  LayoutDashboard,
  LogIn,
  LogOut,
  Plus,
  Save,
  Settings,
  Sparkles,
  Table2,
  UploadCloud,
} from 'lucide-react';
import type React from 'react';
import {useEffect, useMemo, useRef, useState} from 'react';
import {authClient, getNeonJWTToken} from '#/lib/auth-client';
import type {JsonObject} from '#/lib/json';
import {listWorkspaceFiles} from './workspace/files';
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

type LocalSelectedFile = {
  id: string;
  name: string;
  size: number;
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
  const [selectedLocalFiles, setSelectedLocalFiles] = useState<
    LocalSelectedFile[]
  >([]);
  const [localWorksheets] = useState<LocalWorksheet[]>(() => [
    {
      id: 'default-worksheet',
      title: 'Worksheet',
      content: createDefaultWorksheetContent(),
    },
  ]);
  const activeWorkspaceId =
    props.mode === 'saved' ? props.workspaceId : 'unsaved-default';
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
    onSuccess: async (workspace) => {
      await queryClient.invalidateQueries({queryKey: cloudWorkspacesQueryKey});
      await navigate({
        to: '/workspaces/$workspaceId',
        params: {workspaceId: workspace.id},
      });
    },
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

  useEffect(() => {
    if (currentWorkspace?.name) {
      setSavedWorkspaceNameDraft(currentWorkspace.name);
    }
  }, [currentWorkspace?.name]);

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

    await createWorkspaceMutation.mutateAsync({
      data: {
        token,
        name: localWorkspaceName,
        worksheetTitle: localWorksheets[0].title,
        worksheetContent: localWorksheets[0].content,
      },
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

  const handleAddFile = async () => {
    if (props.mode === 'unsaved') {
      await handleSaveWorkspace();
      return;
    }

    if (!token) {
      setIsSignInToSaveOpen(true);
      return;
    }

    fileInputRef.current?.click();
  };

  const handleFileInputChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const nextFiles = Array.from(event.target.files ?? []).map((file) => ({
      id: `${file.name}:${file.size}:${file.lastModified}`,
      name: file.name,
      size: file.size,
    }));

    setSelectedLocalFiles(nextFiles);
    event.target.value = '';
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
                    {duckDbRuntime.tableNames.map((tableName) => (
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
                    {selectedLocalFiles.map((file) => (
                      <div className="schema-table" key={file.id}>
                        <Table2 className="size-4" aria-hidden />
                        <div className="min-w-0">
                          <div className="schema-table-name">{file.name}</div>
                          <div className="schema-table-meta">
                            {formatBytes(file.size)}
                          </div>
                        </div>
                      </div>
                    ))}
                    {!workspaceFilesQuery.data?.length &&
                    duckDbRuntime.tableNames.length === 0 &&
                    selectedLocalFiles.length === 0 ? (
                      <div className="schema-empty">
                        {duckDbRuntime.status === 'initializing'
                          ? 'Preparing runtime'
                          : 'No tables'}
                      </div>
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
                  <div className="worksheet-start">
                    <Button className="new-worksheet-button" type="button">
                      <Plus className="size-4" aria-hidden />
                      New Worksheet
                    </Button>

                    <div
                      className="block-toolbar"
                      aria-label="Worksheet block types"
                    >
                      <BlockTypePreview
                        icon={<Database className="size-4" />}
                        label="Query"
                      />
                      <BlockTypePreview
                        icon={<LayoutDashboard className="size-4" />}
                        label="Dashboard"
                      />
                      <BlockTypePreview
                        icon={<Table2 className="size-4" />}
                        label="Data Table"
                      />
                      <BlockTypePreview
                        icon={<BarChart3 className="size-4" />}
                        label="Chart"
                      />
                    </div>
                  </div>
                </div>
              </section>

              <aside className="assistant-panel">
                <div className="assistant-header">
                  <div className="assistant-title">
                    <Bot className="size-4" aria-hidden />
                    Assistant
                  </div>
                  <Button variant="ghost" size="icon" className="topbar-icon">
                    <Sparkles className="size-4" aria-hidden />
                    <span className="sr-only">New assistant thread</span>
                  </Button>
                </div>
                <div className="assistant-thread">
                  <div className="assistant-message">
                    Ask about this workspace.
                  </div>
                </div>
              </aside>
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
    </main>
  );
}

function BlockTypePreview({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button className="block-type-button" type="button">
      {icon}
      <span>{label}</span>
    </button>
  );
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
