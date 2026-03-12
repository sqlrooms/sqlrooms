import {PivotEditor, type PivotSource} from '@sqlrooms/pivot';
import {
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sqlrooms/ui';
import {produce} from 'immer';
import React, {useMemo} from 'react';
import {findSheetIdForCell} from '../helpers';
import {useCellsStore} from '../hooks';
import type {CellContainerProps, PivotCell} from '../types';

const EMPTY_CELL_IDS: string[] = [];

export type PivotCellContentProps = {
  id: string;
  cell: PivotCell;
  renderContainer: (props: CellContainerProps) => React.ReactElement;
};

function PivotSourceSelect({id, cell}: {id: string; cell: PivotCell}) {
  const updateCell = useCellsStore((state) => state.cells.updateCell);
  const tables = useCellsStore((state) => state.db.tables);
  const ownerSheetId = useCellsStore((state) =>
    findSheetIdForCell(state as any, id),
  );
  const sheetCellIds = useCellsStore(
    (state) =>
      (ownerSheetId
        ? state.cells.config.sheets[ownerSheetId]?.cellIds
        : undefined) ?? EMPTY_CELL_IDS,
  );
  const cellsData = useCellsStore((state) => state.cells.config.data);
  const cellsStatus = useCellsStore((state) => state.cells.status);

  const sqlOptions = useMemo(
    () =>
      sheetCellIds
        .map((cellId) => {
          const candidate = cellsData[cellId];
          if (!candidate || candidate.type !== 'sql') {
            return undefined;
          }
          const status = cellsStatus[cellId];
          return {
            id: candidate.id,
            label:
              (status?.type === 'sql' ? status.resultView : undefined) ??
              candidate.data.resultName ??
              candidate.data.title ??
              candidate.id,
          };
        })
        .filter((option): option is {id: string; label: string} =>
          Boolean(option),
        ),
    [cellsData, cellsStatus, sheetCellIds],
  );

  const value = cell.data.source
    ? cell.data.source.kind === 'table'
      ? `table:${cell.data.source.tableName}`
      : `sql:${cell.data.source.sqlId}`
    : undefined;

  const handleValueChange = (nextValue: string) => {
    const nextSource: PivotSource | undefined = nextValue.startsWith('table:')
      ? {kind: 'table', tableName: nextValue.replace('table:', '')}
      : nextValue.startsWith('sql:')
        ? {kind: 'sql', sqlId: nextValue.replace('sql:', '')}
        : undefined;

    updateCell(id, (current) =>
      produce(current, (draft) => {
        if (draft.type === 'pivot') {
          draft.data.source = nextSource;
        }
      }),
    );
  };

  return (
    <div className="space-y-2">
      <Label>Source</Label>
      <Select value={value} onValueChange={handleValueChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select a source" />
        </SelectTrigger>
        <SelectContent>
          {tables.map((table) => (
            <SelectItem
              key={`table:${table.tableName}`}
              value={`table:${table.tableName}`}
            >
              {table.tableName}
            </SelectItem>
          ))}
          {sqlOptions.map((option) => (
            <SelectItem key={`sql:${option.id}`} value={`sql:${option.id}`}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export const PivotCellContent: React.FC<PivotCellContentProps> = ({
  id,
  cell,
  renderContainer,
}) => {
  const updateCell = useCellsStore((state) => state.cells.updateCell);
  const runCell = useCellsStore((state) => state.cells.runCell);
  const status = useCellsStore((state) => state.cells.status[id]);
  const tables = useCellsStore((state) => state.db.tables);
  const getCellResult = useCellsStore((state) => state.cells.getCellResult);
  const sourceSqlStatus = useCellsStore((state) =>
    cell.data.source?.kind === 'sql'
      ? state.cells.status[cell.data.source.sqlId]
      : undefined,
  );
  const sourceResultVersion = useCellsStore((state) =>
    cell.data.source?.kind === 'sql'
      ? state.cells.resultVersion[cell.data.source.sqlId]
      : undefined,
  );

  const availableTables = useMemo(
    () => tables.map((table) => table.tableName),
    [tables],
  );
  const runtime = useMemo(() => {
    const source = cell.data.source;
    if (!source) {
      return {};
    }
    if (source.kind === 'table') {
      const table = tables.find(
        (candidate) => candidate.tableName === source.tableName,
      );
      if (!table) {
        return {};
      }
      return {
        querySource: {
          tableRef: table.table.toString(),
          columns: table.columns.map((column) => ({
            name: column.name,
            type: column.type,
          })),
        },
        sourceRelation: table.table.toString(),
      };
    }

    const resultView =
      sourceSqlStatus?.type === 'sql' ? sourceSqlStatus.resultView : undefined;
    if (!resultView) {
      return {};
    }
    const result = getCellResult(source.sqlId)?.arrowTable;
    const columns = result?.schema.fields.map((field) => ({
      name: field.name,
      type: String(field.type),
    }));
    if (!columns?.length) {
      return {sourceRelation: resultView};
    }
    return {
      querySource: {
        tableRef: resultView,
        columns,
      },
      sourceRelation: resultView,
    };
  }, [
    cell.data.source,
    getCellResult,
    sourceResultVersion,
    sourceSqlStatus,
    tables,
  ]);

  const querySource = runtime.querySource;

  const pivotStatus =
    status?.type === 'pivot'
      ? ({
          state: status.status,
          stale: status.stale,
          lastError: status.lastError,
          lastRunTime: status.lastRunTime,
          relations: status.resultViews,
          sourceRelation: status.sourceRelation,
        } as const)
      : undefined;

  const content = (
    <div className="h-[720px]">
      <PivotEditor
        source={cell.data.source}
        config={cell.data.pivotConfig}
        status={pivotStatus}
        querySource={querySource}
        availableTables={availableTables}
        callbacks={{
          onConfigChange: (config) =>
            updateCell(id, (current) =>
              produce(current, (draft) => {
                if (draft.type === 'pivot') {
                  draft.data.pivotConfig = config;
                }
              }),
            ),
          onRun: () => runCell(id),
        }}
      >
        <PivotEditor.Source>
          <>
            <PivotSourceSelect id={id} cell={cell} />
            <PivotEditor.RendererSelector />
            <PivotEditor.AggregatorSelector />
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Values</Label>
                <PivotEditor.RunButton />
              </div>
              <PivotEditor.Values />
            </div>
          </>
        </PivotEditor.Source>
        <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
              <PivotEditor.Rows />
              <PivotEditor.Columns />
            </div>
            <PivotEditor.AvailableFields />
          </div>
          <PivotEditor.Output />
        </div>
      </PivotEditor>
    </div>
  );

  return renderContainer({
    header: (
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold text-gray-400 uppercase">
          Pivot
        </span>
      </div>
    ),
    content,
  });
};
