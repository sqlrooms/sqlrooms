import {FC} from 'react';
import {ChartPanelRendererProps} from '../dashboard/MosaicDashboardSlice';
import {UseGenerateSpecResult} from './useGenerateSpec';
import {ChartSpecErrorDisplay} from './ChartSpecErrorDisplay';
import {VgPlotChart} from '../VgPlotChart';
import {useChartRetainer} from './useChartRetainer';
import {useBrushSelectionParams} from './useBrushSelectionParams';

export type SpecChartProps = ChartPanelRendererProps & {
  tableName: string;
  spec: UseGenerateSpecResult;
};

export const SpecChart: FC<SpecChartProps> = ({
  panel,
  dashboardId,
  selectionName,
  spec,
}) => {
  const retention = useChartRetainer(dashboardId, panel.id);
  const params = useBrushSelectionParams(selectionName);

  if (spec.error) {
    return <ChartSpecErrorDisplay error={spec.error} />;
  }

  return <VgPlotChart spec={spec.spec} params={params} retention={retention} />;
};
