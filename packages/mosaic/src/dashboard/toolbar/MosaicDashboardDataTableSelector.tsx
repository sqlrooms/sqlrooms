import {FC, useCallback} from 'react';
import {useStoreWithMosaicDashboard} from '../MosaicDashboardSlice';
import {DataTableSelector} from '../../components/DataTableSelector';
import {useTablesWithColumns} from '../../hooks/useTablesWithColumns';
import {useDataTable} from '../../hooks/useDataTable';
import type {DataTable} from '@sqlrooms/db';

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

  const selectedTable = useDataTable(selectedTableName);

  const setSelectedTable = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.setSelectedTable,
  );

  const handleTableChange = useCallback(
    (table: DataTable) => {
      setSelectedTable(dashboardId, table.table.toString());
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
