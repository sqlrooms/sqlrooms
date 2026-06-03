import React, {useCallback} from 'react';
import {useMosaicDashboardContext} from '../MosaicDashboardContext';
import {useStoreWithMosaicDashboard} from '../MosaicDashboardSlice';
import {MosaicDashboardAddPanelDropdown} from './MosaicDashboardAddPanelDropdown';
import {MosaicDashboardResetFiltersButton} from './MosaicDashboardResetFiltersButton';
import {DataTableSelector} from '../../components/DataTableSelector';
import {useTablesWithColumns} from '../../hooks/useTablesWithColumns';
import {useDataTable} from '../../hooks/useDataTable';
import type {DataTable} from '@sqlrooms/db';

export const MosaicDashboardToolbar: React.FC = () => {
  const {dashboardId} = useMosaicDashboardContext();

  const tables = useTablesWithColumns();
  const selectedTableName = useStoreWithMosaicDashboard(
    (state) =>
      state.mosaicDashboard.config.dashboardsById[dashboardId]?.selectedTable,
  );
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

  if (!selectedTableName) {
    return null;
  }

  return (
    <div className="flex items-center justify-between border-b px-5 py-2">
      <div className="flex items-center gap-2">
        <MosaicDashboardResetFiltersButton dashboardId={dashboardId} />
      </div>
      <div className="flex items-center gap-2">
        {selectedTable && (
          <DataTableSelector
            className="w-48"
            onChange={handleTableChange}
            tables={tables}
            value={selectedTable}
          />
        )}
        <MosaicDashboardAddPanelDropdown dashboardId={dashboardId} />
      </div>
    </div>
  );
};
