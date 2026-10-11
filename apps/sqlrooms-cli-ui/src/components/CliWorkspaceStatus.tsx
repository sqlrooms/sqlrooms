import {useEffect, useState} from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
} from '@sqlrooms/ui';
import {authorizedFetch} from '../browserAuth';
import {runtimeConfig} from '../runtimeEnvironment';
import {uiStatePersistenceController} from '../store';

type Workspace = {
  workspaceId: string;
  name: string;
  databasePath: string;
  availability: string;
  reason?: string;
  lifecycle: string;
  lastCheckedAt?: number;
};
type Identity = {workspaceId: string; name: string; readiness: string};

async function api(path: string, body?: unknown) {
  const response = await authorizedFetch(
    `${runtimeConfig.apiBaseUrl ?? ''}${path}`,
    body === undefined
      ? undefined
      : {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(body),
        },
  );
  const result = await response.json();
  if (!response.ok || result.ok === false)
    throw new Error(result.message || 'Workspace operation failed.');
  return result;
}

/** Shows the actual project location, persistence state, and shared recent catalog. */
export function CliWorkspaceStatus() {
  const [identity, setIdentity] = useState<Identity>();
  const [open, setOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [locating, setLocating] = useState<Workspace>();
  const [path, setPath] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(uiStatePersistenceController.getState());
  useEffect(() => uiStatePersistenceController.subscribe(setSaving), []);
  useEffect(() => {
    let disposed = false;
    const update = () =>
      api('/api/agent/identity')
        .then((value) => {
          if (!disposed) setIdentity(value);
        })
        .catch(() => {});
    void update();
    const timer = setInterval(update, 5000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, []);
  const refresh = async (offset = 0) => {
    const value = await api(`/api/workspaces?refresh=true&offset=${offset}`);
    setWorkspaces((previous) =>
      offset ? [...previous, ...value.workspaces] : value.workspaces,
    );
    setNextOffset(value.nextOffset);
  };
  const perform = async (action: () => Promise<unknown>) => {
    setError('');
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Workspace operation failed.');
    }
  };
  const saveLabel = saving.error
    ? 'Save failed'
    : saving.saving
      ? 'Saving…'
      : saving.dirty
        ? 'Unsaved changes'
        : saving.lastSavedAt
          ? 'Saved'
          : 'No pending changes';
  return (
    <>
      <div className="border-border bg-background flex items-center gap-3 border-b px-3 py-1 text-xs">
        <button
          className="max-w-48 truncate font-medium whitespace-nowrap"
          onClick={() => {
            setName(identity?.name ?? '');
            setRenaming(true);
          }}
        >
          {identity?.name ?? 'Workspace'}
        </button>
        <span
          className="text-muted-foreground truncate"
          title={runtimeConfig.dbPath}
        >
          {runtimeConfig.dbPath}
        </span>
        <span className="ml-auto whitespace-nowrap" role="status">
          {saveLabel}
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void perform(() => api('/api/workspaces/reveal', {}))}
        >
          Reveal in folder
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(true);
            void perform(() => refresh());
          }}
        >
          Recent Workspaces
        </Button>
      </div>
      {error && (
        <div role="alert" className="text-destructive px-3 py-1 text-sm">
          {error}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Recent Workspaces</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Keep the owning browser page open for agent tools. A second tab
            cannot take over its connection.
          </p>
          <p className="text-sm">
            Current workspace: {identity?.readiness ?? 'Connecting…'}
          </p>
          <Button
            variant="outline"
            onClick={() => void perform(() => refresh())}
          >
            Refresh
          </Button>
          {workspaces.map((workspace) => (
            <div
              key={workspace.workspaceId}
              className="space-y-2 border-b py-3"
            >
              <div className="font-medium">{workspace.name}</div>
              <div className="text-xs break-all">{workspace.databasePath}</div>
              <div className="text-muted-foreground text-xs">
                {workspace.lifecycle} ·{' '}
                {workspace.availability === 'inaccessible'
                  ? 'Unavailable'
                  : workspace.availability}
                {workspace.reason ? ` (${workspace.reason})` : ''}
                {workspace.lastCheckedAt
                  ? ` · checked ${new Date(workspace.lastCheckedAt * 1000).toLocaleTimeString()}`
                  : ''}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    void perform(() =>
                      api('/api/workspaces/open', {
                        workspaceId: workspace.workspaceId,
                      }),
                    )
                  }
                >
                  Open
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setLocating(workspace);
                    setPath(workspace.databasePath);
                  }}
                >
                  Locate…
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (
                      window.confirm(
                        'Forget this history entry? Files and running workspaces will be kept. Managed projects can be rediscovered.',
                      )
                    )
                      void perform(async () => {
                        await api('/api/workspaces/forget', {
                          workspaceId: workspace.workspaceId,
                        });
                        await refresh();
                      });
                  }}
                >
                  Forget
                </Button>
              </div>
            </div>
          ))}
          {nextOffset !== null && (
            <Button onClick={() => void perform(() => refresh(nextOffset))}>
              Load more
            </Button>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(locating)}
        onOpenChange={(value) => {
          if (!value) setLocating(undefined);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Locate workspace</DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            Confirm this is the relocated file for {locating?.name}. SQLRooms
            cannot independently verify it is the same workspace.
          </p>
          <Input
            aria-label="Replacement database path"
            value={path}
            onChange={(event) => setPath(event.target.value)}
          />
          <Button
            onClick={() =>
              void perform(async () => {
                await api('/api/workspaces/locate', {
                  workspaceId: locating?.workspaceId,
                  path,
                  confirmed: true,
                });
                setLocating(undefined);
                await refresh();
              })
            }
          >
            Confirm relocated file
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Workspace title</DialogTitle>
          </DialogHeader>
          <Input
            aria-label="Workspace title"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Button
            onClick={() =>
              void perform(async () => {
                const value = await api('/api/workspaces/rename', {
                  workspaceId: identity?.workspaceId,
                  name,
                });
                setIdentity(
                  (previous) => previous && {...previous, name: value.name},
                );
                setRenaming(false);
              })
            }
          >
            Save title
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
