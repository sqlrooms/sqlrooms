import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {Link, useNavigate} from '@tanstack/react-router';
import {
  Button,
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
  CircleDot,
  Cloud,
  Command,
  Database,
  FileSpreadsheet,
  LayoutDashboard,
  LogIn,
  LogOut,
  Plus,
  Save,
  Search,
  Settings,
  Sparkles,
  Table2,
  UploadCloud,
} from 'lucide-react';
import type React from 'react';
import {useMemo, useState} from 'react';
import {authClient, getNeonJWTToken} from '#/lib/auth-client';
import type {JsonObject} from '#/lib/json';
import {
  createCloudWorkspace,
  getCloudWorkspace,
  listCloudWorkspaces,
} from './workspace/cloudWorkspaces';
import {createDefaultWorksheetContent} from './worksheet/defaultBlockDocument';

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

const cloudWorkspacesQueryKey = ['cloudWorkspaces'] as const;

export function WorkspaceShell(props: WorkspaceShellProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {data: session} = authClient.useSession();
  const [localWorkspaceName, setLocalWorkspaceName] =
    useState('Untitled Workspace');
  const [localWorksheets] = useState<LocalWorksheet[]>(() => [
    {
      id: 'default-worksheet',
      title: 'Worksheet',
      content: createDefaultWorksheetContent(),
    },
  ]);

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

  const currentWorkspace =
    props.mode === 'saved' ? savedWorkspaceQuery.data : null;
  const worksheets = useMemo(() => {
    if (currentWorkspace?.worksheets.length) return currentWorkspace.worksheets;
    return localWorksheets;
  }, [currentWorkspace, localWorksheets]);
  const selectedWorksheet = worksheets[0];

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
      await handleSignIn();
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

  const workspaceTitle =
    currentWorkspace?.name ??
    (props.mode === 'saved' ? 'Loading workspace...' : localWorkspaceName);

  return (
    <main className="dark app-background sqlrooms-web-root">
      <TooltipProvider>
        <SidebarProvider defaultOpen>
          <Sidebar collapsible="icon" className="sqlrooms-sidebar">
            <SidebarHeader className="gap-3">
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton className="h-auto gap-3 py-2">
                    <Database className="size-5" aria-hidden />
                    <div className="min-w-0 text-left">
                      <div className="truncate text-sm font-semibold">
                        SQLRooms
                      </div>
                      <div className="truncate text-xs text-shell-subtle">
                        {props.mode === 'saved' ? 'Saved' : 'Unsaved'}
                      </div>
                    </div>
                    <ChevronDown className="ml-auto size-4 text-shell-subtle" />
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>

              <div className="workspace-name-field group-data-[collapsible=icon]:hidden">
                <Input
                  id="workspace-name"
                  name="workspaceName"
                  value={workspaceTitle}
                  disabled={props.mode === 'saved'}
                  onChange={(event) =>
                    setLocalWorkspaceName(event.target.value)
                  }
                  aria-label="Workspace name"
                />
              </div>
            </SidebarHeader>

            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel className="text-shell-subtle">
                  Data
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton>
                        <UploadCloud className="size-4" aria-hidden />
                        <span>Upload file</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton>
                        <Database className="size-4" aria-hidden />
                        <span>DuckDB</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
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

              <SidebarGroup>
                <SidebarGroupLabel className="text-shell-subtle">
                  Workspaces
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {(workspacesQuery.data ?? []).map((workspace) => (
                      <SidebarMenuItem key={workspace.id}>
                        <SidebarMenuButton asChild>
                          <Link
                            to="/workspaces/$workspaceId"
                            params={{workspaceId: workspace.id}}
                          >
                            <CircleDot className="size-4" aria-hidden />
                            <span>{workspace.name}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>

            <SidebarFooter>
              <SidebarMenu>
                {props.mode === 'unsaved' ? (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => void handleSaveWorkspace()}
                      disabled={createWorkspaceMutation.isPending}
                    >
                      <Save className="size-4" aria-hidden />
                      <span>Save Workspace</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ) : null}
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
                <Button variant="ghost" size="sm" className="topbar-button">
                  <Search className="size-4" aria-hidden />
                  Search
                </Button>
                <Button variant="ghost" size="icon" className="topbar-icon">
                  <Command className="size-4" aria-hidden />
                  <span className="sr-only">Command palette</span>
                </Button>
              </div>
              <div className="topbar-right">
                <div className="runtime-pill">
                  <Cloud className="size-3.5" aria-hidden />
                  {props.mode === 'saved' ? 'Neon' : 'Local'}
                </div>
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
                  <div className="assistant-message">Ask about this workspace.</div>
                </div>
              </aside>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
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
