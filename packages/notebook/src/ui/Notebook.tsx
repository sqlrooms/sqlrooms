import {SqlMonacoEditor} from '@sqlrooms/sql-editor';
import {Button, EditableText} from '@sqlrooms/ui';
import React from 'react';
import {RoomShellSliceStateWithNotebook} from '../slices/NotebookSlice';

type StoreHook = <T>(selector: (s: RoomShellSliceStateWithNotebook) => T) => T;

export function createNotebookComponents(useStore: StoreHook) {
  const TabsBar: React.FC = () => {
    const tabs = useStore((s) => s.config.notebook.tabs);
    const currentTabId = useStore((s) => s.config.notebook.currentTabId);
    const setCurrent = useStore((s) => s.notebook.setCurrentTab);
    const addTab = useStore((s) => s.notebook.addTab);
    const renameTab = useStore((s) => s.notebook.renameTab);
    return (
      <div className="flex items-center gap-2 border-b p-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`rounded px-2 py-1 ${
              t.id === currentTabId ? 'bg-muted' : 'hover:bg-muted'
            }`}
            onClick={() => setCurrent(t.id)}
          >
            <EditableText
              value={t.title}
              minWidth={80}
              onChange={(v) => renameTab(t.id, v)}
            />
          </button>
        ))}
        <Button size="xs" variant="outline" onClick={() => addTab()}>
          + Add
        </Button>
      </div>
    );
  };

  const CellView: React.FC<{id: string}> = ({id}) => {
    const cell = useStore((s) => s.config.notebook.cells[id]);
    const update = useStore((s) => s.notebook.updateCell);
    const rename = useStore((s) => s.notebook.renameCell);
    const run = useStore((s) => s.notebook.runCell);
    if (!cell) return null;
    if (cell.type === 'sql') {
      return (
        <div className="rounded border">
          <div className="flex items-center justify-between border-b px-2 py-1">
            <EditableText value={cell.name} onChange={(v) => rename(id, v)} />
            <div className="flex items-center gap-2 text-xs">
              <span className="uppercase text-gray-500">SQL</span>
              <Button size="xs" variant="secondary" onClick={() => run(id)}>
                Run
              </Button>
            </div>
          </div>
          <SqlMonacoEditor
            className="h-48"
            value={cell.sql}
            onChange={(v) =>
              update(id, (c) => ({...c, sql: v || ''} as typeof cell))
            }
          />
          {cell.status === 'error' && (
            <div className="border-t p-2 text-xs text-red-600">
              {cell.lastError}
            </div>
          )}
          {cell.status === 'success' && cell.outputTable && (
            <div className="border-t p-2 text-xs text-green-700">
              Created view: {cell.outputTable}
            </div>
          )}
        </div>
      );
    }
    if (cell.type === 'text') {
      return (
        <div className="rounded border">
          <div className="flex items-center justify-between border-b px-2 py-1">
            <EditableText value={cell.name} onChange={(v) => rename(id, v)} />
            <span className="text-xs uppercase text-gray-500">Text</span>
          </div>
          <textarea
            className="h-32 w-full p-2 text-sm"
            value={cell.text}
            onChange={(e) =>
              update(id, (c) => ({...c, text: e.target.value} as typeof cell))
            }
          />
        </div>
      );
    }
    if (cell.type === 'markdown') {
      return (
        <div className="rounded border">
          <div className="flex items-center justify-between border-b px-2 py-1">
            <EditableText value={cell.name} onChange={(v) => rename(id, v)} />
            <span className="text-xs uppercase text-gray-500">Markdown</span>
          </div>
          <textarea
            className="h-32 w-full p-2 text-sm"
            value={cell.markdown}
            onChange={(e) =>
              update(
                id,
                (c) => ({...c, markdown: e.target.value} as typeof cell),
              )
            }
          />
        </div>
      );
    }
    if (cell.type === 'vega') {
      return (
        <div className="rounded border">
          <div className="flex items-center justify-between border-b px-2 py-1">
            <EditableText value={cell.name} onChange={(v) => rename(id, v)} />
            <span className="text-xs uppercase text-gray-500">Vega</span>
          </div>
          <SqlMonacoEditor
            className="h-40"
            value={cell.sql}
            onChange={(v) =>
              update(id, (c) => ({...c, sql: v || ''} as typeof cell))
            }
          />
          <div className="p-2 text-xs text-gray-500">Chart preview TBD</div>
        </div>
      );
    }
    if (cell.type === 'input') {
      const input = cell.input;
      return (
        <div className="rounded border">
          <div className="flex items-center justify-between border-b px-2 py-1">
            <EditableText value={cell.name} onChange={(v) => rename(id, v)} />
            <span className="text-xs uppercase text-gray-500">Input</span>
          </div>
          <div className="p-2 text-sm">
            <div className="mb-2">
              <label className="mr-2">Variable:</label>
              <input
                className="rounded border px-2 py-1"
                value={input.varName}
                onChange={(e) =>
                  update(
                    id,
                    (c) =>
                      ({
                        ...c,
                        input: {...(c as any).input, varName: e.target.value},
                      } as typeof cell),
                  )
                }
              />
            </div>
            {input.kind === 'text' && (
              <input
                className="w-full rounded border px-2 py-1"
                value={input.value}
                onChange={(e) =>
                  update(
                    id,
                    (c) =>
                      ({
                        ...c,
                        input: {...(c as any).input, value: e.target.value},
                      } as typeof cell),
                  )
                }
              />
            )}
            {input.kind === 'slider' && (
              <input
                type="range"
                min={input.min}
                max={input.max}
                step={input.step}
                value={input.value}
                onChange={(e) =>
                  update(
                    id,
                    (c) =>
                      ({
                        ...c,
                        input: {
                          ...(c as any).input,
                          value: Number(e.target.value),
                        },
                      } as typeof cell),
                  )
                }
              />
            )}
            {input.kind === 'dropdown' && (
              <select
                className="rounded border px-2 py-1"
                value={input.value}
                onChange={(e) =>
                  update(
                    id,
                    (c) =>
                      ({
                        ...c,
                        input: {...(c as any).input, value: e.target.value},
                      } as typeof cell),
                  )
                }
              >
                {input.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  const Notebook: React.FC = () => {
    const currentTabId = useStore((s) => s.config.notebook.currentTabId);
    const tab = useStore((s) =>
      s.config.notebook.tabs.find((t) => t.id === currentTabId),
    );
    const addCell = useStore((s) => s.notebook.addCell);
    if (!tab) return null;
    return (
      <div className="flex h-full flex-col">
        <TabsBar />
        <div className="flex items-center gap-2 border-b p-2">
          <Button size="xs" onClick={() => addCell(tab.id, 'sql')}>
            + SQL
          </Button>
          <Button size="xs" onClick={() => addCell(tab.id, 'markdown')}>
            + Markdown
          </Button>
          <Button size="xs" onClick={() => addCell(tab.id, 'text')}>
            + Text
          </Button>
          <Button size="xs" onClick={() => addCell(tab.id, 'vega')}>
            + Vega
          </Button>
          <Button size="xs" onClick={() => addCell(tab.id, 'input')}>
            + Input
          </Button>
        </div>
        <div className="flex-1 space-y-2 overflow-auto p-2">
          {tab.cellOrder.map((id) => (
            <CellView key={id} id={id} />
          ))}
        </div>
      </div>
    );
  };

  return {Notebook};
}

