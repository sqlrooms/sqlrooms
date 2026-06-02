import {BarChart3Icon} from 'lucide-react';
import {useCallback, type FC} from 'react';
import {MosaicDashboardChartHeaderActions} from './MosaicDashboardChartHeaderActions';
import type {ChartPanelConfig} from '../../dashboard/dashboard-types';
import {
  type MosaicDashboardPanelRenderer,
  type ChartPanelRendererProps,
  useStoreWithMosaicDashboard,
  getMosaicDashboardPanelId,
} from '../../dashboard/MosaicDashboardSlice';
import {ChartConfig} from '../chart-types/chart-config';
import {MosaicChart} from '../MosaicChart';

const MosaicDashboardChartRenderer: FC<ChartPanelRendererProps> = ({
  panel,
  dashboardId,
  dashboard,
  selectionName,
}) => {
  const tableName = dashboard.selectedTable;

  const updatePanel = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.updatePanel,
  );

  const runtimeKey = getMosaicDashboardPanelId(dashboardId, panel.id);

  const handleConfigChange = useCallback(
    (config: ChartConfig) => {
      updatePanel(dashboardId, panel.id, {config});
    },
    [dashboardId, panel.id, updatePanel],
  );

  return (
    <MosaicChart
      tableName={tableName}
      selectionName={selectionName}
      config={panel.config}
      runtimeKey={runtimeKey}
      onConfigChange={handleConfigChange}
    />
  );
};

export const mosaicDashboardChartRenderer: MosaicDashboardPanelRenderer<ChartPanelConfig> =
  {
    component: MosaicDashboardChartRenderer,
    headerActions: MosaicDashboardChartHeaderActions,
    icon: BarChart3Icon,
  };
