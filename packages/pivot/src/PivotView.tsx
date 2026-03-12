import {DataTable} from '@sqlrooms/duckdb';
import type {BaseRoomStoreState} from '@sqlrooms/room-store';
import {useBaseRoomStore} from '@sqlrooms/room-store';
import React, {useEffect, useMemo} from 'react';
import {PivotEditor} from './PivotEditor';
import {PivotSliceState} from './types';

type PivotRootState = BaseRoomStoreState &
  PivotSliceState & {
    db: {
      tables: DataTable[];
    };
  };

const PivotViewContent: React.FC<{pivotId: string}> = ({pivotId}) => {
  const getPivotStore = useBaseRoomStore(
    (state: PivotRootState) => state.pivot.getPivotStore,
  );
  const pivotStore = useMemo(
    () => getPivotStore(pivotId),
    [getPivotStore, pivotId],
  );

  return <PivotEditor store={pivotStore} autoRun />;
};

export const PivotView: React.FC = () => {
  const tables = useBaseRoomStore<PivotRootState, DataTable[]>(
    (state) => state.db.tables,
  );
  const pivotConfig = useBaseRoomStore(
    (state: PivotRootState) => state.pivot.config,
  );
  const currentPivotId = pivotConfig.currentPivotId;
  const currentPivot = currentPivotId
    ? pivotConfig.pivots[currentPivotId]
    : undefined;
  const setSource = useBaseRoomStore(
    (state: PivotRootState) => state.pivot.setSource,
  );

  const selectedTable = useMemo(() => {
    if (currentPivot?.source?.kind !== 'table') {
      return tables[0];
    }
    const tableName = currentPivot.source.tableName;
    return tables.find((table) => table.tableName === tableName) ?? tables[0];
  }, [currentPivot?.source, tables]);

  useEffect(() => {
    if (currentPivot && !currentPivot.source && selectedTable) {
      setSource(currentPivot.id, {
        kind: 'table',
        tableName: selectedTable.tableName,
      });
    }
  }, [currentPivot, selectedTable, setSource]);

  const tableSource =
    currentPivot?.source?.kind === 'table' ? currentPivot.source : undefined;

  if (!currentPivot || !selectedTable || !tableSource) {
    return null;
  }

  return <PivotViewContent pivotId={currentPivot.id} />;
};
