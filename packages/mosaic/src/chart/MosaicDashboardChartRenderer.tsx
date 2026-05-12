import {SpinnerPane} from '@sqlrooms/ui';
import {BarChart3Icon} from 'lucide-react';
import React, {type FC, useCallback} from 'react';
import {ChartSettingsPanel} from './chart-settings';
import {MosaicDashboardPanelLayout} from '../dashboard/MosaicDashboardPanelLayout';
import {MosaicDashboardChartHeaderActions} from './MosaicDashboardChartHeaderActions';
import {
  type MosaicDashboardPanelRenderer,
  type ChartPanelConfig,
  type ChartPanelRendererProps,
  useStoreWithMosaicDashboard,
} from '../dashboard/MosaicDashboardSlice';
import {useChartTypeDefinition} from '../chart-types/useChartTypeDefinition';
import {useChartRetainer} from './useChartRetainer';
import {useBrushSelectionParams} from './useBrushSelectionParams';
import {DashboardChartErrorBoundary} from './DashboardChartErrorBoundary';
import {
  ChartTypeDefinition,
  isComponentChartType,
  isSpecChartType,
} from '../chart-types/base-types';
import {SpecChart} from './SpecChart';
import {useGenerateSpec, UseGenerateSpecResult} from './useGenerateSpec';
import {MosaicReadyConnection} from '../MosaicSlice';

const MosaicDashboardChartRenderer: FC<ChartPanelRendererProps> = (props) => {
  const {panel} = props;
  const connection = useStoreWithMosaicDashboard(
    (state) => state.mosaic.connection,
  );

  const chartTypeDef = useChartTypeDefinition(panel.config.chartType);
  const tableName = panel.source?.tableName;

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
    <MosaicDashboardChartContent
      {...props}
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

type MosaicDashboardChartContentProps = ChartPanelRendererProps & {
  chartTypeDef: ChartTypeDefinition;
  tableName: string;
  connection: MosaicReadyConnection;
};

const MosaicDashboardChartContent: FC<MosaicDashboardChartContentProps> = ({
  chartTypeDef,
  tableName,
  connection,
  ...props
}) => {
  const {dashboardId, panel} = props;

  const updatePanel = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.updatePanel,
  );

  const isSettingsOpen = panel.config.settingsOpen;

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      updatePanel(dashboardId, panel.id, {
        config: {...panel.config, settingsOpen: isOpen},
      });
    },
    [dashboardId, panel.config, panel.id, updatePanel],
  );

  const spec = useGenerateSpec(tableName, panel.config.settings, chartTypeDef);

  const settingsContent = (
    <ChartSettingsPanel
      dashboardId={dashboardId}
      panel={panel}
      spec={spec.spec}
      tableName={tableName}
      onClose={() => handleOpenChange(false)}
    />
  );

  const chartContent = (
    <div className="h-full overflow-auto p-2">
      <DashboardChartErrorBoundary>
        <ChartContentRenderer
          {...props}
          chartTypeDefinition={chartTypeDef}
          tableName={tableName}
          connection={connection}
          spec={spec}
        />
      </DashboardChartErrorBoundary>
    </div>
  );

  return (
    <div className="h-full min-h-0">
      <MosaicDashboardPanelLayout
        isOpen={isSettingsOpen}
        onIsOpenChange={handleOpenChange}
        settings={settingsContent}
        content={chartContent}
      />
    </div>
  );
};

type ChartContentRendererProps = ChartPanelRendererProps & {
  chartTypeDefinition: ChartTypeDefinition;
  tableName: string;
  connection: MosaicReadyConnection;
  spec: UseGenerateSpecResult;
};

const ChartContentRenderer: FC<ChartContentRendererProps> = (props) => {
  const {
    selectionName,
    panel,
    dashboardId,
    chartTypeDefinition,
    tableName,
    connection,
    spec,
  } = props;

  const retention = useChartRetainer(dashboardId, panel.id);
  const params = useBrushSelectionParams(selectionName);

  if (isSpecChartType(chartTypeDefinition)) {
    return <SpecChart {...props} spec={spec} />;
  }

  if (isComponentChartType(chartTypeDefinition)) {
    return React.createElement(chartTypeDefinition.renderer, {
      tableName,
      config: panel.config,
      coordinator: connection.coordinator,
      params,
      retention,
    });
  }

  throw new Error('Unsupported chart type definition');
};
