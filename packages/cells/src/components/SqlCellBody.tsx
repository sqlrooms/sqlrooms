import {QueryDataTable} from '@sqlrooms/data-table';
import {SqlMonacoEditor} from '@sqlrooms/sql-editor';
import type {SqlCellBodyProps} from '../types';
import {SqlCellRunButton} from './SqlCellRunButton';

/**
 * Editable SQL cell body with controls and optional result rendering.
 */
export function SqlCellBody({
  sql,
  onSqlChange,
  onRun,
  onCancel,
  status,
  resultName,
  renderResult,
  runLabel = 'Run',
  disabled,
}: SqlCellBodyProps) {
  const showResultTable =
    !renderResult && resultName && status?.state === 'success';
  return (
    <div className="flex w-full flex-col gap-2">
      <div className="p-2">
        <SqlCellRunButton
          onRun={onRun}
          onCancel={onCancel}
          status={status}
          runLabel={runLabel}
          disabled={disabled}
        />
      </div>
      <div className="relative flex min-h-[200px] flex-col">
        <div>
          <SqlMonacoEditor
            className="absolute inset-0 h-full w-full"
            value={sql}
            onChange={(v) => onSqlChange(v || '')}
            options={{minimap: {enabled: false}}}
          />
        </div>
        {renderResult}
        {showResultTable && (
          <div className="overflow-hidden border-t">
            <QueryDataTable
              query={`SELECT * FROM ${resultName}`}
              fontSize="text-xs"
            />
          </div>
        )}
      </div>
    </div>
  );
}
