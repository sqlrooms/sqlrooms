import {QueryDataTable} from '@sqlrooms/data-table';
import {SqlMonacoEditor} from '@sqlrooms/sql-editor';
import {Button, useToast} from '@sqlrooms/ui';
import {FC} from 'react';
import {CanvasNodeData, useStoreWithCanvas} from '../CanvasSlice';
import {CanvasNodeContainer} from './CanvasNodeContainer';
// import type * as Monaco from 'monaco-editor';
// type EditorInstance = Monaco.editor.IStandaloneCodeEditor;
// type MonacoInstance = typeof Monaco;

const EDITOR_OPTIONS: Parameters<typeof SqlMonacoEditor>[0]['options'] = {
  minimap: {enabled: false},
  lineNumbers: 'off',
  scrollbar: {
    handleMouseWheel: false,
  },
};

type SqlData = Extract<CanvasNodeData, {type: 'sql'}>;

export const SqlNode: FC<{id: string; data: SqlData}> = ({id, data}) => {
  const sql = data.sql || '';
  const updateNode = useStoreWithCanvas((s) => s.canvas.updateNode);
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
    <CanvasNodeContainer
      id={id}
      headerRight={
        <>
          <Button size="sm" variant="secondary" onClick={() => execute(id)}>
            Run
          </Button>
          <span className="text-[10px] uppercase text-gray-500">SQL</span>
        </>
      }
    >
      <div className="flex h-full w-full flex-col">
        <div className="flex flex-1 flex-col">
          <div className="relative flex-1">
            <SqlMonacoEditor
              className="absolute inset-0 p-1"
              value={sql}
              options={EDITOR_OPTIONS}
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
          <div className="flex-1 overflow-hidden border-t">
            <QueryDataTable
              query={`SELECT * FROM ${result.tableName}`}
              fontSize="text-xs"
            />
          </div>
        )}
      </div>
    </CanvasNodeContainer>
  );
};
