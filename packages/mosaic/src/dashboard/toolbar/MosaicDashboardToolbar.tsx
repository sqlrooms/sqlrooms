import {FC, useCallback} from 'react';
import {useMosaicDashboardContext} from '../MosaicDashboardContext';
import {useStoreWithMosaicDashboard} from '../MosaicDashboardSlice';
import {MosaicDashboardAddPanelDropdown} from './MosaicDashboardAddPanelDropdown';
import {MosaicDashboardResetFiltersButton} from './MosaicDashboardResetFiltersButton';
import {MosaicDashboardDataTableSelector} from './MosaicDashboardDataTableSelector';
import {useDataTable} from '../../hooks/useDataTable';
import {BlockCaptionEditor} from '../../components/BlockCaptionEditor';

export const MosaicDashboardToolbar: FC = () => {
  const {dashboardId} = useMosaicDashboardContext();

  const dashboard = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.config.dashboardsById[dashboardId],
  );
  const selectedTableName = dashboard?.selectedTable;
  const dashboardTitle = dashboard?.title ?? '';

  const selectedTable = useDataTable(selectedTableName);
  const tableName = selectedTable?.table.table;

  const setDashboardTitle = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.setDashboardTitle,
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
      <BlockCaptionEditor
        value={dashboardTitle}
        placeholder={tableName || 'Dashboard title'}
        onChange={handleTitleChange}
      />

      <div className="flex items-center gap-2">
        <MosaicDashboardAddPanelDropdown dashboardId={dashboardId} />
        <MosaicDashboardDataTableSelector dashboardId={dashboardId} />
        <MosaicDashboardResetFiltersButton dashboardId={dashboardId} />
      </div>
    </div>
  );
};
