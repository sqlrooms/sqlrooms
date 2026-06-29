import {FC, useCallback, useMemo} from 'react';
import {useStoreWithMosaicDashboard} from '../MosaicDashboardSlice';
import {DataTableSelector} from '../../components/DataTableSelector';
import {useTablesWithColumns} from '../../hooks/useTablesWithColumns';
import type {DataTable} from '@sqlrooms/db';
import {
  getMosaicTableIdentity,
  resolveMosaicTableReference,
} from '../../mosaicTableReference';

interface MosaicDashboardDataTableSelectorProps {
  dashboardId: string;
}

export const MosaicDashboardDataTableSelector: FC<
  MosaicDashboardDataTableSelectorProps
> = ({dashboardId}) => {
  const tables = useTablesWithColumns();
  const dashboard = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.config.dashboardsById[dashboardId],
  );
  const selectedTableName = dashboard?.selectedTable;

  const selectedTable = useMemo(
    () => resolveMosaicTableReference(tables, selectedTableName).table,
    [selectedTableName, tables],
  );

  const setSelectedTable = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.setSelectedTable,
  );

  const handleTableChange = useCallback(
    (table: DataTable) => {
      setSelectedTable(dashboardId, getMosaicTableIdentity(table.table));
    },
    [dashboardId, setSelectedTable],
  );

  return (
    <DataTableSelector
      onChange={handleTableChange}
      tables={tables}
      value={selectedTable}
    />
  );
};
