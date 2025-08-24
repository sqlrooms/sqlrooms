import {QueryDataTable} from '@sqlrooms/data-table';
import {SqlMonacoEditor} from '@sqlrooms/sql-editor';
import {Button, EditableText, useToast} from '@sqlrooms/ui';
import {FC} from 'react';
import {CanvasNodeData, useStoreWithCanvas} from '../CanvasSlice';
import {CanvasNodeContainer} from './CanvasNodeContainer';
import {AddChildButton} from './AddChildButton';
// import type * as Monaco from 'monaco-editor';
// type EditorInstance = Monaco.editor.IStandaloneCodeEditor;
// type MonacoInstance = typeof Monaco;

type SqlData = Extract<CanvasNodeData, {type: 'sql'}>;

export const SqlNode: FC<{id: string; data: SqlData}> = ({id, data}) => {
  const sql = data.sql || '';
  const addNode = useStoreWithCanvas((s) => s.canvas.addNode);
  const updateNode = useStoreWithCanvas((s) => s.canvas.updateNode);
  const renameNode = useStoreWithCanvas((s) => s.canvas.renameNode);
  const tables = useStoreWithCanvas((s) => s.db.tables);
  const execute = useStoreWithCanvas((s) => s.canvas.executeSqlNodeQuery);
  const result = useStoreWithCanvas((s) => s.canvas.sqlResults[id]);
  const {toast} = useToast();
  // const handleEditorMount = useCallback(
  //   (editor: EditorInstance, monaco: MonacoInstance) => {
  //     editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
  //       if (editor.hasTextFocus()) {
  //         execute(id);
  //       }
  //     });
  //   },
  //   [execute],
  // );

  return (
    <CanvasNodeContainer id={id}>
      <div className="flex h-full w-full flex-col">
        <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
            <EditableText
              className="text-sm font-medium"
              value={data.title}
              onChange={async (v) => {
                try {
                  await renameNode(id, v);
                } catch (e) {
                  toast({
                    variant: 'destructive',
                    title: 'Rename failed',
                    description: e instanceof Error ? e.message : String(e),
                  });
                }
              }}
            />
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => execute(id)}>
                Run
              </Button>
              <span className="text-[10px] uppercase text-gray-500">SQL</span>
            </div>
          </div>
          <div className="relative flex-1">
            <SqlMonacoEditor
              className="absolute inset-0 p-1"
              value={sql}
              options={{minimap: {enabled: false}, lineNumbers: 'off'}}
              onChange={(v) =>
                updateNode(id, (d) => ({...(d as SqlData), sql: v || ''}))
              }
              tableSchemas={tables}
              // onMount={handleEditorMount}
            />
          </div>
        </div>
        {result?.status === 'error' && (
          <div className="flex-1 overflow-auto whitespace-pre-wrap border-t p-4 font-mono text-xs text-red-600">
            {result.error}
          </div>
        )}
        {result?.status === 'success' && (
          <>
            <div className="flex-1 overflow-hidden border-t">
              <QueryDataTable
                query={`SELECT * FROM ${result.tableName}`}
                fontSize="text-xs"
              />
            </div>
            <AddChildButton
              className="absolute -right-10 top-1/2"
              onAddSql={() => addNode({parentId: id, nodeType: 'sql'})}
              onAddVega={() => addNode({parentId: id, nodeType: 'vega'})}
            />
          </>
        )}
      </div>
    </CanvasNodeContainer>
  );
};
