import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {Link, useNavigate} from '@tanstack/react-router';
import {
  BarChart3,
  Database,
  FileSpreadsheet,
  LayoutDashboard,
  LogIn,
  LogOut,
  Plus,
  Save,
  Table2,
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
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <Database className="brand-icon" aria-hidden />
          <div>
            <div className="brand-title">SQLRooms</div>
            <div className="brand-subtitle">
              {props.mode === 'saved' ? 'Saved workspace' : 'Unsaved workspace'}
            </div>
          </div>
        </div>

        <section className="sidebar-section">
          <div className="sidebar-label">Workspace</div>
          <input
            id="workspace-name"
            name="workspaceName"
            className="workspace-name-input"
            value={workspaceTitle}
            disabled={props.mode === 'saved'}
            onChange={(event) => setLocalWorkspaceName(event.target.value)}
            aria-label="Workspace name"
          />
        </section>

        <section className="sidebar-section">
          <div className="sidebar-row">
            <div className="sidebar-label">Workspace items</div>
            <button className="icon-button" type="button" aria-label="New worksheet">
              <Plus size={16} />
            </button>
          </div>
          <nav className="worksheet-list" aria-label="Worksheets">
            {worksheets.map((worksheet) => (
              <button className="worksheet-item active" key={worksheet.id}>
                <FileSpreadsheet size={16} />
                <span>{worksheet.title}</span>
              </button>
            ))}
          </nav>
        </section>

        <section className="sidebar-section">
          <div className="sidebar-label">Saved workspaces</div>
          <nav className="workspace-list" aria-label="Saved workspaces">
            {(workspacesQuery.data ?? []).map((workspace) => (
              <Link
                className="workspace-link"
                key={workspace.id}
                to="/workspaces/$workspaceId"
                params={{workspaceId: workspace.id}}
              >
                {workspace.name}
              </Link>
            ))}
          </nav>
        </section>

        <div className="sidebar-footer">
          {session?.user ? (
            <button
              className="secondary-button"
              type="button"
              onClick={() => void authClient.signOut()}
            >
              <LogOut size={16} />
              Sign out
            </button>
          ) : (
            <button
              className="secondary-button"
              type="button"
              onClick={() => void handleSignIn()}
            >
              <LogIn size={16} />
              Sign in
            </button>
          )}
          {props.mode === 'unsaved' ? (
            <button
              className="primary-button"
              type="button"
              onClick={() => void handleSaveWorkspace()}
              disabled={createWorkspaceMutation.isPending}
            >
              <Save size={16} />
              Save
            </button>
          ) : null}
        </div>
      </aside>

      <section className="workspace-surface">
        <header className="workspace-header">
          <div>
            <h1>{selectedWorksheet?.title ?? 'Worksheet'}</h1>
            <p>
              Worksheets are BlockDocument-based analysis surfaces. Query,
              dashboard, data table, and chart blocks land here in the next
              stages.
            </p>
          </div>
          <div className="status-pill">
            {props.mode === 'saved' ? 'Neon-backed' : 'Local runtime'}
          </div>
        </header>

        <section className="block-toolbar" aria-label="Worksheet block types">
          <BlockTypePreview icon={<Database size={18} />} label="Query" />
          <BlockTypePreview
            icon={<LayoutDashboard size={18} />}
            label="Dashboard"
          />
          <BlockTypePreview icon={<Table2 size={18} />} label="Data table" />
          <BlockTypePreview icon={<BarChart3 size={18} />} label="Chart" />
        </section>

        <article className="worksheet-card">
          <h2>Default worksheet</h2>
          <p>
            This is the first milestone shell: it opens immediately without
            login, keeps runtime work unsaved by default, and prepares a
            save-after-login path for Neon persistence.
          </p>
          <div className="empty-block">
            Drop in BlockDocument-backed worksheet blocks here.
          </div>
        </article>
      </section>
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
