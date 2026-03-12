import {DataTable} from '@sqlrooms/duckdb';
import {useBaseRoomStore} from '@sqlrooms/room-store';
import React, {useEffect, useMemo} from 'react';
import {PivotEditor} from './PivotEditor';
import {createPivotQuerySourceFromTable} from './sql';
import {PivotSliceState} from './types';

type PivotRootState = PivotSliceState & {
  db: {
    tables: DataTable[];
  };
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
  const setConfig = useBaseRoomStore(
    (state: PivotRootState) => state.pivot.setConfig,
  );
  const runPivot = useBaseRoomStore(
    (state: PivotRootState) => state.pivot.runPivot,
  );

  const selectedTable = useMemo(() => {
    if (currentPivot?.source?.kind !== 'table') {
      return tables[0];
    }
    const tableName = currentPivot.source.tableName;
    return tables.find((table) => table.tableName === tableName) ?? tables[0];
  }, [currentPivot?.source, tables]);

  const availableTables = useMemo(
    () => tables.map((table) => table.tableName),
    [tables],
  );

  useEffect(() => {
    if (currentPivot && !currentPivot.source && selectedTable) {
      setSource(currentPivot.id, {
        kind: 'table',
        tableName: selectedTable.tableName,
      });
    }
  }, [currentPivot, selectedTable, setSource]);

  if (!currentPivot || !selectedTable) {
    return null;
  }

  const querySource = createPivotQuerySourceFromTable(selectedTable);

  return (
    <PivotEditor
      source={currentPivot.source}
      config={currentPivot.config}
      status={currentPivot.status}
      availableTables={availableTables}
      querySource={querySource}
      callbacks={{
        onSourceChange: (source) => setSource(currentPivot.id, source),
        onConfigChange: (config) => setConfig(currentPivot.id, config),
        onRun: () => runPivot(currentPivot.id),
      }}
      autoRun
    />
  );
};
