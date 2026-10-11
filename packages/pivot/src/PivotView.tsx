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

export const PivotView: React.FC<{pivotId: string}> = ({pivotId}) => {
  const tables = useBaseRoomStore<PivotRootState, DataTable[]>(
    (state) => state.db.tables,
  );
  const pivot = useBaseRoomStore(
    (state: PivotRootState) => state.pivot.config.pivots[pivotId],
  );
  const setSource = useBaseRoomStore(
    (state: PivotRootState) => state.pivot.setSource,
  );

  const selectedTable = useMemo(() => {
    if (pivot?.source?.kind !== 'table') {
      return tables[0];
    }
    const tableName = pivot.source.tableName;
    return tables.find((table) => table.tableName === tableName) ?? tables[0];
  }, [pivot?.source, tables]);

  useEffect(() => {
    if (pivot && !pivot.source && selectedTable) {
      setSource(pivot.id, {
        kind: 'table',
        tableName: selectedTable.tableName,
      });
    }
  }, [pivot, selectedTable, setSource]);

  const tableSource =
    pivot?.source?.kind === 'table' ? pivot.source : undefined;

  if (!pivot || !selectedTable || !tableSource) {
    return null;
  }

  return <PivotViewContent pivotId={pivot.id} />;
};
