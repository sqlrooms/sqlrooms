import {FC, useCallback, useMemo} from 'react';
import {useMosaicDashboardContext} from '../MosaicDashboardContext';
import {useStoreWithMosaicDashboard} from '../MosaicDashboardSlice';
import {MosaicDashboardAddPanelDropdown} from './MosaicDashboardAddPanelDropdown';
import {MosaicDashboardResetFiltersButton} from './MosaicDashboardResetFiltersButton';
import {MosaicDashboardDataTableSelector} from './MosaicDashboardDataTableSelector';
import {BlockCaptionEditor, BlockHeader} from '@sqlrooms/documents';
import {useTablesWithColumns} from '../../hooks/useTablesWithColumns';
import {resolveMosaicTableReference} from '../../mosaicTableReference';

export const MosaicDashboardToolbar: FC = () => {
  const {dashboardId, headerActions, readOnly} = useMosaicDashboardContext();

  const dashboard = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.config.dashboardsById[dashboardId],
  );
  const selectedTableName = dashboard?.selectedTable;
  const dashboardTitle = dashboard?.title ?? '';

  const tables = useTablesWithColumns();
  const selectedTable = useMemo(
    () => resolveMosaicTableReference(tables, selectedTableName).table,
    [selectedTableName, tables],
  );
  const tableName = selectedTable?.table.table;

  const setDashboardTitle = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.setDashboardTitle,
  );

  const handleTitleChange = useCallback(
    (title: string | undefined) => {
      if (readOnly) return;

      setDashboardTitle(dashboardId, title || '');
    },
    [dashboardId, readOnly, setDashboardTitle],
  );

  if (!selectedTableName && !headerActions) {
    return null;
  }

  return (
    <BlockHeader
      data-dashboard-toolbar
      actionsClassName="min-w-0 shrink gap-2 overflow-hidden"
      actions={
        <>
          {selectedTableName ? (
            <>
              <MosaicDashboardDataTableSelector dashboardId={dashboardId} />
              {!readOnly ? (
                <MosaicDashboardAddPanelDropdown dashboardId={dashboardId} />
              ) : null}
              <MosaicDashboardResetFiltersButton dashboardId={dashboardId} />
            </>
          ) : null}
          {headerActions}
        </>
      }
    >
      <BlockCaptionEditor
        value={dashboardTitle}
        placeholder={tableName || 'Dashboard title'}
        isReadOnly={readOnly}
        onChange={handleTitleChange}
      />
    </BlockHeader>
  );
};
