import {Button} from '@sqlrooms/ui';
import type {FileSystemTree} from '@webcontainer/api';
import React from 'react';
import {useCellsStore} from '@sqlrooms/cells';
import {
  createArtifact,
  generateAppFromPrompt,
  readArtifactFiles,
  writeArtifactFiles,
} from '../projectApi';
import {runtimeConfig, useRoomStore} from '../store';

const TEMPLATE_OPTIONS = [
  {id: 'mosaic-dashboard', label: 'Mosaic dashboard (cross-filtering)'},
  {id: 'basic-dashboard', label: 'Basic dashboard (table + chart)'},
];

function deriveAppName(prompt: string): string {
  const trimmed = prompt.trim();
  if (!trimmed) return `App ${new Date().toLocaleTimeString()}`;
  return trimmed.split(/\s+/).slice(0, 6).join(' ');
}

export const AppBuilderSheet: React.FC = () => {
  const currentSheetId = useCellsStore((s) => s.cells.config.currentSheetId);
  const renameSheet = useCellsStore((s) => s.cells.renameSheet);
  const artifactId = useRoomStore((s) =>
    currentSheetId
      ? s.appProject.config.sheetArtifactMap[currentSheetId]
      : undefined,
  );
  const setSheetArtifact = useRoomStore((s) => s.appProject.setSheetArtifact);
  const applyFilesTree = useRoomStore((s) => s.webcontainer.applyFilesTree);
  const initializeWebcontainer = useRoomStore((s) => s.webcontainer.initialize);
  const webcontainerStatus = useRoomStore((s) => s.webcontainer.serverStatus);

  const [prompt, setPrompt] = React.useState('');
  const [template, setTemplate] = React.useState('mosaic-dashboard');
  const [name, setName] = React.useState('');
  const [status, setStatus] = React.useState<string>('');
  const [busy, setBusy] = React.useState(false);

  const loadArtifactRuntime = React.useCallback(
    async (id: string) => {
      const loaded = await readArtifactFiles(runtimeConfig, id);
      const {files, patched} = ensureRunnableViteScaffold(loaded);
      if (patched.length > 0) {
        await writeArtifactFiles(runtimeConfig, id, patched);
      }
      const tree = toFileSystemTree(files);
      await applyFilesTree({filesTree: tree, activeFilePath: '/src/App.jsx'});
      await initializeWebcontainer();
    },
    [applyFilesTree, initializeWebcontainer],
  );

  React.useEffect(() => {
    if (!artifactId) return;
    void loadArtifactRuntime(artifactId);
  }, [artifactId, loadArtifactRuntime]);

  if (!currentSheetId) return null;

  const onCreate = async () => {
    const finalName = (name || deriveAppName(prompt)).trim();
    setBusy(true);
    setStatus('Creating app artifact...');
    try {
      const artifact = await createArtifact(runtimeConfig, {
        type: 'app',
        name: finalName,
        metadata: {template},
      });
      setSheetArtifact(currentSheetId, artifact.artifactId);
      renameSheet(currentSheetId, finalName);

      setStatus('Generating initial app...');
      const result = await generateAppFromPrompt(
        runtimeConfig,
        artifact.artifactId,
        {
          prompt,
          template,
        },
      );
      await loadArtifactRuntime(artifact.artifactId);
      setStatus(
        result.status === 'ok'
          ? `Generated successfully in ${result.attempts} attempt(s).`
          : `Generation failed: ${result.errors.join('; ')}`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  if (artifactId) {
    return (
      <div className="flex h-full flex-col gap-2 p-4">
        <h3 className="text-sm font-medium">App Builder</h3>
        <p className="text-muted-foreground text-sm">
          App artifact is connected to this tab.
        </p>
        <p className="text-muted-foreground text-xs">
          artifactId: {artifactId}
        </p>
        <div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => loadArtifactRuntime(artifactId)}
          >
            Run app
          </Button>
        </div>
        {webcontainerStatus.type === 'ready' && webcontainerStatus.url ? (
          <iframe
            className="mt-2 h-[60vh] w-full rounded border bg-white"
            src={webcontainerStatus.url}
          />
        ) : (
          <p className="text-muted-foreground text-xs">
            Runtime status: {webcontainerStatus.type}
          </p>
        )}
        {status && <p className="text-muted-foreground text-xs">{status}</p>}
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col gap-3 p-4">
      <h3 className="text-base font-medium">Create New App</h3>
      <label className="text-muted-foreground text-xs">Prompt</label>
      <textarea
        className="bg-background min-h-28 rounded-md border p-2 text-sm"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Build an interactive dashboard for sales by region..."
      />
      <label className="text-muted-foreground text-xs">Template</label>
      <select
        className="bg-background rounded-md border p-2 text-sm"
        value={template}
        onChange={(e) => setTemplate(e.target.value)}
      >
        {TEMPLATE_OPTIONS.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
      <label className="text-muted-foreground text-xs">
        App name (tab title, optional)
      </label>
      <input
        className="bg-background rounded-md border p-2 text-sm"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={deriveAppName(prompt)}
      />
      <div>
        <Button disabled={busy || !prompt.trim()} onClick={onCreate}>
          {busy ? 'Creating...' : 'Create App'}
        </Button>
      </div>
      {status && <p className="text-muted-foreground text-xs">{status}</p>}
    </div>
  );
};

function toFileSystemTree(
  files: Array<{path: string; content: string}>,
): FileSystemTree {
  const root: any = {};
  for (const file of files) {
    const clean = file.path.replace(/^\/+/, '');
    if (!clean) continue;
    const parts = clean.split('/').filter(Boolean);
    let cursor = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLeaf = i === parts.length - 1;
      if (isLeaf) {
        cursor[part] = {file: {contents: file.content}};
      } else {
        cursor[part] = cursor[part] || {directory: {}};
        cursor = cursor[part].directory;
      }
    }
  }
  return root as FileSystemTree;
}

function ensureRunnableViteScaffold(
  files: Array<{path: string; content: string}>,
): {
  files: Array<{path: string; content: string}>;
  patched: Array<{path: string; content: string}>;
} {
  const byPath = new Map(files.map((f) => [f.path, f.content]));
  const patched: Array<{path: string; content: string}> = [];

  const upsert = (path: string, content: string) => {
    if (!byPath.has(path)) {
      byPath.set(path, content);
      patched.push({path, content});
    }
  };

  upsert(
    '/index.html',
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SQLRooms Generated App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`,
  );
  upsert(
    '/src/main.jsx',
    `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
`,
  );
  upsert(
    '/package.json',
    JSON.stringify(
      {
        name: 'sqlrooms-generated-app',
        private: true,
        version: '0.0.0',
        type: 'module',
        scripts: {dev: 'vite', build: 'vite build'},
        dependencies: {react: '^19.0.0', 'react-dom': '^19.0.0'},
        devDependencies: {vite: '^7.0.0'},
      },
      null,
      2,
    ),
  );
  upsert(
    '/src/App.jsx',
    `export default function App() {
  return <main style={{padding: 16}}><h1>SQLRooms App</h1></main>;
}
`,
  );

  return {
    files: Array.from(byPath.entries()).map(([path, content]) => ({
      path,
      content,
    })),
    patched,
  };
}
