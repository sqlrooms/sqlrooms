import {useState} from 'react';
import {getTableIdentity} from '@sqlrooms/duckdb';
import {authorizedFetch} from './auth';
import {connector, roomStore, useRoomStore} from './store';
import {documentBlocks} from './Document';

/** Manual commands use the same registry and schema validation as MCP. */
export function CommandDialog({
  title,
  command,
  input,
  onClose,
}: {
  title: string;
  command?: string;
  input?: unknown;
  onClose: () => void;
}) {
  const [text, setText] = useState(JSON.stringify(input ?? {}, null, 2));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [path, setPath] = useState('');
  const [result, setResult] = useState('');
  const [selected, setSelected] = useState('');
  const [name, setName] = useState('');
  const tables = useRoomStore((s) => s.db.tables);
  const [tableName, setTableName] = useState(
    tables[0] ? getTableIdentity(tables[0].table) : '',
  );
  const [field, setField] = useState(tables[0]?.columns[0]?.name ?? '');
  const currentId = roomStore.getState().artifacts.config.currentArtifactId;
  const blocks = currentId ? documentBlocks(currentId) : [];
  const chosen = blocks.find((b) => b.id === selected);
  const isCreate = command?.startsWith('block-document.create-');
  const isEdit = title === 'Edit document blocks';
  const call = async (id: string, args: unknown) => {
    const value = await roomStore
      .getState()
      .commands.invokeCommand(id, args, {surface: 'palette'});
    if (!value.success) throw new Error(value.error ?? 'Command failed.');
    return value;
  };
  const run = async () => {
    setBusy(true);
    setError('');
    try {
      if (title === 'Open or create workspace') {
        const response = await authorizedFetch('/api/workspaces/open', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(
            path
              ? {path, openBrowser: true}
              : {
                  create: {name: name || 'Untitled workspace'},
                  openBrowser: true,
                },
          ),
        });
        const value = await response.json();
        if (!response.ok || !value.ok)
          throw new Error(value.message ?? 'Could not open workspace.');
        setResult(value.launchUrl ?? value.readiness);
        return;
      }
      if (isEdit && chosen && currentId) {
        if (
          chosen.type === 'statefulBlock' &&
          chosen.blockType === 'html-app'
        ) {
          await call('html-app.write-revision', {
            appId: chosen.blockInstanceId,
            patch: {
              files: {'/index.html': text},
              requestedCapabilities: ['query'],
              grantedCapabilities: ['query'],
            },
          });
        } else if (
          chosen.type === 'statefulBlock' &&
          chosen.blockType === 'data-table'
        ) {
          await call('data-table.configure', {
            blockInstanceId: chosen.blockInstanceId,
            settings: JSON.parse(text),
          });
        } else
          await call('block-document.update-block', {
            artifactId: currentId,
            blockId: chosen.id,
            block: JSON.parse(text),
          });
      } else if (command) {
        let args = JSON.parse(text);
        if (isCreate)
          args = {
            ...args,
            caption: name || args.caption,
            title: name || args.title,
            ...(command.endsWith('chart-block')
              ? {
                  tableName,
                  config: {chartType: 'count-plot', settings: {field}},
                }
              : args.blockType === 'data-table'
                ? {tableName}
                : {}),
          };
        await call(command, args);
      } else {
        const parsed = JSON.parse(text);
        if (parsed.query) {
          const rows = await connector.query(parsed.query);
          setResult(
            JSON.stringify(
              rows.toArray(),
              (_, v) => (typeof v === 'bigint' ? String(v) : v),
              2,
            ),
          );
          return;
        }
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="roomie-modal" role="dialog" aria-label={title}>
      <div className="roomie-dialog">
        <h2>{title}</h2>
        {title === 'Open or create workspace' ? (
          <>
            <p className="mb-3 text-sm">
              Open a DuckDB file, or leave the path empty to create a managed
              workspace.
            </p>
            <input
              aria-label="Database path"
              className="w-full"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="/path/to/analysis.duckdb"
            />
            <input
              aria-label="Workspace name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="New workspace name"
            />
          </>
        ) : isCreate ? (
          <>
            <label className="block text-sm">
              Title
              <input
                className="block w-full"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Optional title"
              />
            </label>
            {(command?.endsWith('chart-block') ||
              (input as {blockType?: string})?.blockType === 'data-table') && (
              <>
                <label className="block text-sm">
                  Table
                  <select
                    className="block w-full"
                    value={tableName}
                    onChange={(e) => {
                      setTableName(e.target.value);
                      setField(
                        tables.find(
                          (t) => getTableIdentity(t.table) === e.target.value,
                        )?.columns[0]?.name ?? '',
                      );
                    }}
                  >
                    <option value="">Choose a table</option>
                    {tables.map((t) => (
                      <option
                        key={getTableIdentity(t.table)}
                        value={getTableIdentity(t.table)}
                      >
                        {t.table.table}
                      </option>
                    ))}
                  </select>
                </label>
                {command?.endsWith('chart-block') && (
                  <label className="block text-sm">
                    Group by
                    <select
                      className="block w-full"
                      value={field}
                      onChange={(e) => setField(e.target.value)}
                    >
                      {tables
                        .find((t) => getTableIdentity(t.table) === tableName)
                        ?.columns.map((c) => (
                          <option key={c.name}>{c.name}</option>
                        ))}
                    </select>
                  </label>
                )}
              </>
            )}
            <p className="text-sm text-slate-500">
              You can adjust the block using its settings in the document.
            </p>
          </>
        ) : (
          <>
            {isEdit && (
              <select
                aria-label="Select block"
                className="w-full"
                value={selected}
                onChange={(e) => {
                  const block = blocks.find((b) => b.id === e.target.value);
                  setSelected(e.target.value);
                  if (
                    block?.type === 'statefulBlock' &&
                    block.blockType === 'html-app'
                  )
                    setText(
                      roomStore
                        .getState()
                        .htmlApps.getApp(block.blockInstanceId)?.files[
                        '/index.html'
                      ] ?? '',
                    );
                  else if (
                    block?.type === 'statefulBlock' &&
                    block.blockType === 'data-table'
                  )
                    setText(
                      JSON.stringify(
                        roomStore.getState().tableExplorers.config.byId[
                          block.blockInstanceId
                        ],
                        null,
                        2,
                      ),
                    );
                  else setText(JSON.stringify(block, null, 2));
                }}
              >
                <option value="">Choose a block</option>
                {blocks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.type === 'statefulBlock' ? b.blockType : b.type} · {b.id}
                  </option>
                ))}
              </select>
            )}
            <textarea
              aria-label={
                chosen?.type === 'statefulBlock' &&
                chosen.blockType === 'html-app'
                  ? 'HTML source'
                  : 'Command input'
              }
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck={false}
            />
          </>
        )}
        {error && (
          <div role="alert" className="roomie-error">
            {error}
          </div>
        )}
        {result && (
          <pre className="max-h-64 overflow-auto text-xs whitespace-pre-wrap">
            {result}
          </pre>
        )}
        <footer>
          <button className="roomie-action" onClick={onClose}>
            Cancel
          </button>
          <button
            className="roomie-action"
            disabled={busy || (isEdit && !chosen)}
            onClick={() => void run()}
          >
            {busy ? 'Working…' : isCreate ? 'Add block' : 'Apply'}
          </button>
        </footer>
      </div>
    </div>
  );
}
