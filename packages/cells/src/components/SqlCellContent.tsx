import React, {useCallback, useEffect, useRef} from 'react';
import {QueryDataTable, QueryDataTableActionsMenu} from '@sqlrooms/data-table';
import {SqlMonacoEditor} from '@sqlrooms/sql-editor';
import {useCellsStore} from '../hooks';
import type {CellContainerProps, SqlCell} from '../types';
import {SqlCellRunButton} from './SqlCellRunButton';
import {produce} from 'immer';
import type * as Monaco from 'monaco-editor';

export type SqlCellContentProps = {
  id: string;
  cell: SqlCell;
  renderContainer: (props: CellContainerProps) => React.ReactElement;
};

export const SqlCellContent: React.FC<SqlCellContentProps> = ({
  id,
  cell,
  renderContainer,
}) => {
  const updateCell = useCellsStore((s) => s.cells.updateCell);
  const runCell = useCellsStore((s) => s.cells.runCell);
  const cancelCell = useCellsStore((s) => s.cells.cancelCell);
  const cellStatus = useCellsStore((s) => s.cells.status[id]);

  const handleSqlChange = useCallback(
    (v: string) => {
      updateCell(id, (c) =>
        produce(c, (draft) => {
          if (draft.type === 'sql') {
            draft.data.sql = v || '';
          }
        }),
      );
    },
    [id, updateCell],
  );

  const handleRun = useCallback(() => {
    runCell(id);
  }, [id, runCell]);

  const handleCancel = useCallback(() => {
    cancelCell(id);
  }, [id, cancelCell]);

  const status =
    cellStatus?.type === 'sql'
      ? {
          state: cellStatus.status,
          message: cellStatus.lastError,
          resultName: cellStatus.resultView || cellStatus.resultName,
        }
      : undefined;

  const resultName = status?.resultName;

  const handleRunRef = useRef(handleRun);
  useEffect(() => {
    handleRunRef.current = handleRun;
  }, [handleRun]);

  const handleSqlEditorMount = useCallback(
    (editor: Monaco.editor.IStandaloneCodeEditor, monaco: typeof Monaco) => {
      // Add keyboard shortcut for running query
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        handleRunRef.current();
      });
    },
    [],
  );

  const content = (
    <div className="flex flex-col">
      <div className="h-full w-full py-1">
        <div className="relative h-full min-h-[200px] w-full">
          <SqlMonacoEditor
            className="absolute inset-0 h-full w-full"
            value={cell.data.sql}
            onChange={(v) => handleSqlChange(v || '')}
            onMount={handleSqlEditorMount}
            options={{
              minimap: {enabled: false},
              scrollBeyondLastLine: false,
              scrollbar: {
                alwaysConsumeMouseWheel: false,
              },
            }}
          />
        </div>
      </div>
      {status?.state === 'error' ? (
        <div className="relative max-h-[400px] overflow-auto p-4">
          <span className="whitespace-pre-wrap font-mono text-xs text-red-600">
            {status.message}
          </span>
        </div>
      ) : resultName ? (
        <div className="relative min-h-[200px] overflow-hidden">
          <QueryDataTable
            className="absolute inset-0 h-full w-full"
            query={`SELECT * FROM ${resultName}`}
            fontSize="text-xs"
            pageSize={10}
            isLoading={status?.state === 'running'}
            renderActions={() => (
              <QueryDataTableActionsMenu
                query={`SELECT * FROM ${resultName}`}
              />
            )}
          />
        </div>
      ) : null}
    </div>
  );

  const footer = null;

  return renderContainer({
    header: (
      <div className="flex w-full items-center gap-2">
        <div className="flex-1" />
        <SqlCellRunButton
          onRun={handleRun}
          onCancel={handleCancel}
          status={status}
          runLabel="Run"
        />
      </div>
    ),
    content,
    footer,
  });
};
