import {
  type CellContainerProps,
  type CellsRootState,
  type SqlCellStatus,
  findSheetIdForCell,
  useCellsStore,
} from '@sqlrooms/cells';
import {useRoomStoreApi} from '@sqlrooms/room-store';
import {
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sqlrooms/ui';
import React, {useEffect, useMemo} from 'react';
import {useStore} from 'zustand';
import {createPivotBoundStore} from './PivotCoreSlice';
import {PivotEditor} from './PivotEditor';
import type {PivotInstanceStore} from './PivotCoreSlice';
import type {PivotSource} from './types';
import {createNotebookPivotBinding} from './pivotCellBinding';
import type {PivotCell} from './pivotCellTypes';

const EMPTY_CELL_IDS: string[] = [];

export type PivotCellContentProps = {
  id: string;
  cell: PivotCell;
  renderContainer: (props: CellContainerProps) => React.ReactElement;
};

function PivotSourceSelect({
  store,
  sqlOptions,
}: {
  store: PivotInstanceStore;
  sqlOptions: Array<{id: string; label: string}>;
}) {
  const tables = useCellsStore((state) => state.db.tables);
  const source = useStore(store, (state) => state.source);

  const value = source
    ? source.kind === 'table'
      ? `table:${source.tableName}`
      : `sql:${source.sqlId}`
    : undefined;

  const handleValueChange = (nextValue: string) => {
    const nextSource: PivotSource | undefined = nextValue.startsWith('table:')
      ? {kind: 'table', tableName: nextValue.replace('table:', '')}
      : nextValue.startsWith('sql:')
        ? {kind: 'sql', sqlId: nextValue.replace('sql:', '')}
        : undefined;
    store.getState().setSource(nextSource);
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
  cell: _cell,
  renderContainer,
}) => {
  const roomStore = useRoomStoreApi<CellsRootState>();
  const ownerSheetId = useCellsStore((state) =>
    findSheetIdForCell(state as CellsRootState, id),
  );
  const sheetCellIds = useCellsStore(
    (state) =>
      state.cells.config.sheets[ownerSheetId ?? '']?.cellIds ?? EMPTY_CELL_IDS,
  );
  const cellsData = useCellsStore((state) => state.cells.config.data);
  const cellsStatus = useCellsStore((state) => state.cells.status);
  const pivotBinding = useMemo(
    () => createNotebookPivotBinding(roomStore),
    [roomStore],
  );
  const pivotStore = useMemo(
    () =>
      createPivotBoundStore({
        rootStore: roomStore,
        id,
        binding: pivotBinding,
      }),
    [id, pivotBinding, roomStore],
  );

  useEffect(() => {
    pivotStore.startSync?.();
    return () => pivotStore.destroy();
  }, [pivotStore]);

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
              (status?.type === 'sql'
                ? (status as SqlCellStatus).resultView
                : undefined) ??
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

  const content = (
    <div className="h-[720px]">
      <PivotEditor store={pivotStore}>
        <PivotEditor.Source>
          <>
            <PivotSourceSelect store={pivotStore} sqlOptions={sqlOptions} />
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
