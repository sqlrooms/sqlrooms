import React, {useCallback} from 'react';
import {QueryDataTable, QueryDataTableActionsMenu} from '@sqlrooms/data-table';
import {SqlMonacoEditor} from '@sqlrooms/sql-editor';
import {useCellsStore} from '../hooks';
import type {CellContainerProps, SqlCell} from '../types';
import {SqlCellRunButton} from './SqlCellRunButton';
import {produce} from 'immer';

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

  const onSqlChange = useCallback(
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

  const onRun = useCallback(() => {
    runCell(id);
  }, [id, runCell]);

  const onCancel = useCallback(() => {
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

  const content = (
    <div className="relative flex min-h-[200px] flex-col">
      <SqlMonacoEditor
        className="min-h-[200px] w-full"
        value={cell.data.sql}
        onChange={(v) => onSqlChange(v || '')}
        options={{minimap: {enabled: false}}}
      />
    </div>
  );

  const footer = resultName ? (
    <div className="overflow-hidden border-t">
      <QueryDataTable
        query={`SELECT * FROM ${resultName}`}
        fontSize="text-xs"
        pageSize={10}
        isLoading={status?.state === 'running'}
        renderActions={() => (
          <QueryDataTableActionsMenu query={`SELECT * FROM ${resultName}`} />
        )}
      />
    </div>
  ) : null;

  return renderContainer({
    header: (
      <div className="flex items-center gap-2">
        <SqlCellRunButton
          onRun={onRun}
          onCancel={onCancel}
          status={status}
          runLabel="Run"
        />
        <span className="text-[10px] font-bold uppercase text-gray-400">
          SQL
        </span>
      </div>
    ),
    content,
    footer,
  });
};
