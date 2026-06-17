import {useMemo} from 'react';
import {type MosaicDashboardAddPanelActionContext} from './action-types';
import {useStoreWithMosaicDashboard} from './MosaicDashboardSlice';
import {useSelectedOrFirstTable} from './useSelectedOrFirstTable';
import {useTablesWithColumns} from '../hooks/useTablesWithColumns';

export function useMosaicDashboardAddPanelActionContext(
  dashboardId: string,
): MosaicDashboardAddPanelActionContext {
  const dashboard = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.config.dashboardsById[dashboardId],
  );
  const chartTypes = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.chartTypes,
  );

  const tables = useTablesWithColumns();
  const selectedTable = useSelectedOrFirstTable(dashboardId);

  return useMemo<MosaicDashboardAddPanelActionContext>(
    () => ({
      dashboardId,
      dashboard,
      selectedTable,
      tables,
      chartTypes,
    }),
    [dashboard, dashboardId, selectedTable, tables, chartTypes],
  );
}
