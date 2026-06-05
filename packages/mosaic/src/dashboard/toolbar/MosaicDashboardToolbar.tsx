import {FC, useCallback} from 'react';
import {EditableText} from '@sqlrooms/ui';
import {useMosaicDashboardContext} from '../MosaicDashboardContext';
import {useStoreWithMosaicDashboard} from '../MosaicDashboardSlice';
import {MosaicDashboardAddPanelDropdown} from './MosaicDashboardAddPanelDropdown';
import {MosaicDashboardResetFiltersButton} from './MosaicDashboardResetFiltersButton';
import {DataTableSelector} from '../../components/DataTableSelector';
import {useTablesWithColumns} from '../../hooks/useTablesWithColumns';
import {useDataTable} from '../../hooks/useDataTable';
import type {DataTable} from '@sqlrooms/db';

export const MosaicDashboardToolbar: FC = () => {
  const {dashboardId} = useMosaicDashboardContext();

  const tables = useTablesWithColumns();
  const dashboard = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.config.dashboardsById[dashboardId],
  );
  const selectedTableName = dashboard?.selectedTable;
  const dashboardTitle = dashboard?.title ?? '';

  const selectedTable = useDataTable(selectedTableName);
  const tableName = selectedTable?.table.table;

  const setSelectedTable = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.setSelectedTable,
  );
  const setDashboardTitle = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.setDashboardTitle,
  );

  const handleTableChange = useCallback(
    (table: DataTable) => {
      setSelectedTable(dashboardId, table.table.toString());
    },
    [dashboardId, setSelectedTable],
  );

  const handleTitleChange = useCallback(
    (title: string | undefined) => {
      setDashboardTitle(dashboardId, title || '');
    },
    [dashboardId, setDashboardTitle],
  );

  if (!selectedTableName) {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-2 border-b px-5 py-2">
      <EditableText
        className="min-w-0 flex-1 text-sm font-medium"
        value={dashboardTitle}
        placeholder={tableName || 'Dashboard title'}
        onChange={handleTitleChange}
      />

      <div className="flex items-center gap-2">
        <MosaicDashboardAddPanelDropdown dashboardId={dashboardId} />
        {selectedTable && (
          <DataTableSelector
            className="w-48"
            onChange={handleTableChange}
            tables={tables}
            value={selectedTable}
          />
        )}
        <MosaicDashboardResetFiltersButton dashboardId={dashboardId} />
      </div>
    </div>
  );
};
