import {SpinnerPane} from '@sqlrooms/ui';
import {BarChart3Icon} from 'lucide-react';
import {type FC} from 'react';
import {MosaicDashboardChartHeaderActions} from './MosaicDashboardChartHeaderActions';
import type {ChartPanelConfig} from '../dashboard/dashboard-types';
import {
  type MosaicDashboardPanelRenderer,
  type ChartPanelRendererProps,
  useStoreWithMosaicDashboard,
} from '../dashboard/MosaicDashboardSlice';
import {useChartTypeDefinition} from '../chart-types/useChartTypeDefinition';
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

  const chartTypeDef = useChartTypeDefinition(panel.config.chartType);
  const tableName = dashboard.selectedTable;

  if (!chartTypeDef) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        Unknown chart type: {panel.config.chartType}
      </div>
    );
  }

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
      dashboardId={dashboardId}
      selectionName={selectionName}
      panel={panel}
      chartTypeDef={chartTypeDef}
      tableName={tableName}
      connection={connection}
    />
  );
};

export const mosaicDashboardChartRenderer: MosaicDashboardPanelRenderer<ChartPanelConfig> =
  {
    component: MosaicDashboardChartRenderer,
    headerActions: MosaicDashboardChartHeaderActions,
    icon: BarChart3Icon,
  };
