import {FC, useCallback} from 'react';
import {useMosaicDashboardContext} from '../MosaicDashboardContext';
import {useStoreWithMosaicDashboard} from '../MosaicDashboardSlice';
import {MosaicDashboardAddPanelDropdown} from './MosaicDashboardAddPanelDropdown';
import {MosaicDashboardResetFiltersButton} from './MosaicDashboardResetFiltersButton';
import {useDataTable, type DataTable} from '@sqlrooms/db';
import {BlockCaptionEditor} from '../../components/BlockCaptionEditor';
import {DataTableSelector} from '../../components/DataTableSelector';
import {useTablesWithColumns} from '../../hooks/useTablesWithColumns';

export const MosaicDashboardToolbar: FC = () => {
  const {dashboardId} = useMosaicDashboardContext();

  const dashboard = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.config.dashboardsById[dashboardId],
  );
  const selectedTableName = dashboard?.selectedTable;
  const dashboardTitle = dashboard?.title ?? '';

  const selectedTable = useDataTable(selectedTableName);
  const tableName = selectedTable?.table.table;
  const tables = useTablesWithColumns();

  const setDashboardTitle = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.setDashboardTitle,
  );
  const setSelectedTable = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.setSelectedTable,
  );

  const handleTitleChange = useCallback(
    (title: string | undefined) => {
      setDashboardTitle(dashboardId, title || '');
    },
    [dashboardId, setDashboardTitle],
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
    <div
      className="flex items-center justify-between gap-2 border-b px-5 py-2"
      data-dashboard-toolbar
    >
      <BlockCaptionEditor
        value={dashboardTitle}
        placeholder={tableName || 'Dashboard title'}
        onChange={handleTitleChange}
      />

      <div className="flex items-center gap-2">
        <DataTableSelector
          tables={tables}
          value={selectedTable}
          onChange={handleTableChange}
        />
        <MosaicDashboardAddPanelDropdown dashboardId={dashboardId} />
        <MosaicDashboardResetFiltersButton dashboardId={dashboardId} />
      </div>
    </div>
  );
};
