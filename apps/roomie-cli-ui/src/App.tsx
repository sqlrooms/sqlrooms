import {ROOMIE_CAPABILITIES} from './capabilities';
import {useEffect, useState} from 'react';
import {getTableIdentity} from '@sqlrooms/duckdb';
import {Document, documentBlocks} from './Document';
import {Bridge} from './bridge';
import {config} from './config';
import {connector, roomStore, storage, useRoomStore} from './store';
import {CommandDialog} from './CommandDialog';

/** Document-only Roomie shell with workspace utilities and visible save status. */
export function App() {
  const artifacts = useRoomStore((s) => s.artifacts.config);
  const tables = useRoomStore((s) => s.db.tables);
  const currentId = artifacts.currentArtifactId;
  const [dialog, setDialog] = useState<{
    title: string;
    command?: string;
    input?: unknown;
  } | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(storage.controller.getState());
  useEffect(() => storage.controller.subscribe(setSaved), []);
  const invoke = async (command: string, input?: unknown) => {
    const result = await roomStore
      .getState()
      .commands.invokeCommand(command, input, {surface: 'palette'});
    if (!result.success) setError(result.error ?? 'Operation failed.');
  };
  const add = (kind: string) => {
    const tableName = tables[0] ? getTableIdentity(tables[0].table) : '';
    setDialog({
      title: `Add ${kind}`,
      command:
        kind === 'chart'
          ? 'block-document.create-chart-block'
          : 'block-document.create-stateful-block',
      input:
        kind === 'chart'
          ? {
              artifactId: currentId,
              tableName,
              config: {
                chartType: 'count-plot',
                settings: {field: tables[0]?.columns[0]?.name},
              },
              caption: 'Chart',
            }
          : {
              artifactId: currentId,
              blockType: kind,
              tableName: kind === 'data-table' ? tableName : undefined,
              title: kind === 'html-app' ? 'HTML app' : kind,
              caption: kind,
              height: 520,
            },
    });
  };
  const edit = () =>
    setDialog({
      title: 'Edit document blocks',
      input: documentBlocks(currentId!),
    });
  return (
    <div className="roomie" id="workspace">
      <header className="roomie-header">
        <span className="roomie-brand">Roomie</span>
        <span
          className="truncate text-xs text-slate-500"
          title={config.databasePath}
        >
          {config.databasePath.split('/').pop()}
        </span>
        <div className="flex-1" />
        <Bridge />
        <button
          className="roomie-action"
          onClick={async () => {
            try {
              await storage.flush();
            } catch (e) {
              setError(String(e));
            }
          }}
        >
          {saved.error
            ? 'Save failed · retry'
            : saved.saving
              ? 'Saving…'
              : saved.dirty
                ? 'Save changes'
                : 'Saved'}
        </button>
        <button
          className="roomie-action"
          onClick={async () => {
            await storage.flush();
            if (!storage.controller.getState().error) location.reload();
          }}
        >
          Reload
        </button>
      </header>
      <div className="roomie-body">
        <aside className="roomie-sidebar">
          <button
            className="font-medium"
            onClick={() => void invoke('block-document.create', {})}
          >
            ＋ New document
          </button>
          <h2>Documents</h2>
          {artifacts.artifactOrder.map((id) => (
            <button
              key={id}
              aria-current={id === currentId}
              onClick={() =>
                roomStore.getState().artifacts.setCurrentArtifact(id)
              }
            >
              ▤ {artifacts.artifactsById[id]?.title}
            </button>
          ))}
          <h2>Data</h2>
          <button
            onClick={() =>
              setDialog({
                title: 'Import local file',
                command: 'db.import-file',
                input: {path: '', tableName: 'imported_data'},
              })
            }
          >
            ＋ Import data
          </button>
          <label className="block cursor-pointer px-2 py-2 text-xs">
            Upload file
            <input
              type="file"
              className="hidden"
              accept=".csv,.parquet,.json,.jsonl"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                try {
                  await connector.loadFile(
                    file,
                    file.name
                      .replace(/\.[^.]+$/, '')
                      .replace(/[^A-Za-z0-9_]/g, '_'),
                  );
                  await roomStore.getState().db.refreshTableSchemas();
                } catch (e) {
                  setError(String(e));
                }
              }}
            />
          </label>
          {tables.map((table) => (
            <button
              key={getTableIdentity(table.table)}
              onClick={() =>
                setDialog({
                  title: `Inspect ${table.table.table}`,
                  input: {
                    columns: table.columns,
                    query: `SELECT * FROM ${table.table.toFullString()} LIMIT 100`,
                  },
                })
              }
            >
              {table.table.table}
            </button>
          ))}
          <h2>Workspace</h2>
          <button
            onClick={() =>
              setDialog({
                title: 'SQL',
                command: 'db.create-table-from-query',
                input: {tableName: 'result', query: 'SELECT 1 AS value'},
              })
            }
          >
            SQL utility
          </button>
          <button
            onClick={() => setDialog({title: 'Open or create workspace'})}
          >
            Open workspace…
          </button>
        </aside>
        <main className="roomie-document">
          {error && (
            <div
              role="alert"
              className="roomie-error"
              onClick={() => setError('')}
            >
              {error}
            </div>
          )}
          {currentId ? (
            <>
              <div className="roomie-toolbar">
                <span className="mr-2 text-xs text-slate-500">Insert</span>
                {ROOMIE_CAPABILITIES.blocks.map((kind) => (
                  <button key={kind} onClick={() => add(kind)}>
                    {kind.replace(/-/g, ' ')}
                  </button>
                ))}
                <div className="flex-1" />
                <button onClick={edit}>Edit blocks</button>
              </div>
              <div className="min-h-0 flex-1">
                <Document key={currentId} id={currentId} />
              </div>
            </>
          ) : (
            <div className="roomie-empty">
              <h1>Make room for an idea.</h1>
              <p>
                Bring your data into a document. Explore it with charts, tables,
                dashboards and small HTML apps.
              </p>
              <button
                className="roomie-action"
                onClick={() => void invoke('block-document.create', {})}
              >
                Create a document
              </button>
            </div>
          )}
        </main>
      </div>
      {dialog && <CommandDialog {...dialog} onClose={() => setDialog(null)} />}
    </div>
  );
}
