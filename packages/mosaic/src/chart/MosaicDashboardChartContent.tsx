import {type FC} from 'react';
import {
  ChartTypeDefinition,
  isComponentChartType,
  isSpecChartType,
} from '../chart-types/base-types';
import {MosaicDashboardVgPlotChart} from './MosaicDashboardVgPlotChart';
import {MosaicDashboardComponentChart} from './MosaicDashboardComponentChart';
import {UseGenerateSpecResult} from './useGenerateSpec';
import {MosaicReadyConnection} from '../MosaicSlice';
import type {ChartPanelConfig} from '../dashboard/dashboard-types';
import {useChartRetainer} from './useChartRetainer';
import {useBrushSelectionParams} from './useBrushSelectionParams';

export type MosaicDashboardChartContentProps = {
  chartTypeDefinition: ChartTypeDefinition;
  tableName: string;
  connection: MosaicReadyConnection;
  spec: UseGenerateSpecResult;
  selectionName: string;
  panel: ChartPanelConfig;
  dashboardId: string;
};

export const MosaicDashboardChartContent: FC<
  MosaicDashboardChartContentProps
> = ({
  selectionName,
  panel,
  dashboardId,
  chartTypeDefinition,
  tableName,
  connection,
  spec,
}) => {
  const retention = useChartRetainer(dashboardId, panel.id);
  const params = useBrushSelectionParams(selectionName);

  if (isSpecChartType(chartTypeDefinition)) {
    return (
      <MosaicDashboardVgPlotChart
        spec={spec}
        retention={retention}
        params={params}
      />
    );
  }

  if (isComponentChartType(chartTypeDefinition)) {
    return (
      <MosaicDashboardComponentChart
        tableName={tableName}
        panel={panel}
        chartTypeDefinition={chartTypeDefinition}
        connection={connection}
        retention={retention}
        params={params}
      />
    );
  }

  throw new Error('Unsupported chart type definition');
};
