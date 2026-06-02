import {SpinnerPane} from '@sqlrooms/ui';
import {BarChart3Icon} from 'lucide-react';
import {useCallback, type FC} from 'react';
import {MosaicDashboardChartHeaderActions} from './MosaicDashboardChartHeaderActions';
import type {ChartPanelConfig} from '../dashboard/dashboard-types';
import {
  type MosaicDashboardPanelRenderer,
  type ChartPanelRendererProps,
  useStoreWithMosaicDashboard,
  getMosaicDashboardPanelId,
} from '../dashboard/MosaicDashboardSlice';
import {ChartConfig} from '../chart-types/chart-config';
import {MosaicDashboardChart} from './MosaicDashboardChart';

const MosaicDashboardChartRenderer: FC<ChartPanelRendererProps> = ({
  panel,
  dashboardId,
  dashboard,
  selectionName,
}) => {
  const connection = useStoreWithMosaicDashboard(
    (state) => state.mosaic.connection,
  );

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

  if (!tableName) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        Please select a data table first
      </div>
    );
  }

  if (connection.status === 'loading' || connection.status === 'idle') {
    return <SpinnerPane className="h-full w-full" />;
  }

  if (connection.status === 'error') {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        Mosaic connection failed
      </div>
    );
  }

  return (
    <MosaicDashboardChart
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
