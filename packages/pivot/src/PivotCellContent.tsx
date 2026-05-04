import {
  type CellContainerProps,
  CellSourceSelector,
  type CellsRootState,
  toDataSourceCell,
  toDataSourceTable,
  fromDataSourceCell,
  fromDataSourceTable,
} from '@sqlrooms/cells';
import {useBaseRoomStore} from '@sqlrooms/room-store';
import {Label} from '@sqlrooms/ui';
import React, {useCallback, useMemo} from 'react';
import {useStore} from 'zustand';
import {PivotEditor} from './PivotEditor';
import type {PivotInstanceStore} from './PivotCoreSlice';
import type {PivotSource, PivotSliceState} from './types';
import type {PivotCell} from './pivotCellTypes';

export type PivotCellContentProps = {
  id: string;
  cell: PivotCell;
  renderContainer: (props: CellContainerProps) => React.ReactElement;
};

const PivotSourceSelect: React.FC<{
  artifactId: string;
  store: PivotInstanceStore;
}> = ({artifactId, store}) => {
  const source = useStore(store, (state) => state.source);

  const value = source
    ? source.kind === 'table'
      ? toDataSourceTable(source.tableName)
      : toDataSourceCell(source.sqlId)
    : undefined;

  const handleValueChange = useCallback(
    (nextValue: string) => {
      const tableRef = fromDataSourceTable(nextValue);
      const cellId = fromDataSourceCell(nextValue);

      const nextSource: PivotSource | undefined = tableRef
        ? {kind: 'table', tableName: tableRef}
        : cellId
          ? {kind: 'sql', sqlId: cellId}
          : undefined;

      store.getState().setSource(nextSource);
    },
    [store],
  );

  return (
    <div className="space-y-2">
      <Label>Source</Label>
      <CellSourceSelector
        artifactId={artifactId}
        value={value}
        onValueChange={handleValueChange}
        className="h-8 w-full"
      />
    </div>
  );
};

type PivotRootState = PivotSliceState &
  CellsRootState & {db: {tables: {tableName: string}[]}};

export const PivotCellContent: React.FC<PivotCellContentProps> = ({
  id,
  cell,
  renderContainer,
}) => {
  const pivotId = cell.data.pivotId;
  const getPivotStore = useBaseRoomStore(
    (state: PivotRootState) => state.pivot.getPivotStore,
  );
  const artifactId = useBaseRoomStore((state: PivotRootState) =>
    state.cells.getArtifactIdForCell(id),
  );
  const pivotStore = useMemo(
    () => getPivotStore(pivotId),
    [getPivotStore, pivotId],
  );

  const content = (
    <div className="h-[720px]">
      <PivotEditor store={pivotStore}>
        <PivotEditor.Source>
          <>
            <PivotSourceSelect
              artifactId={artifactId ?? ''}
              store={pivotStore}
            />
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
