import {FC} from 'react';
import {ChartPanelRendererProps} from '../dashboard/MosaicDashboardSlice';
import {UseGenerateSpecResult} from './useGenerateSpec';
import {MosaicDashboardVgPlotError} from './MosaicDashboardVgPlotError';
import {VgPlotChart} from '../VgPlotChart';
import {useChartRetainer} from './useChartRetainer';
import {useBrushSelectionParams} from './useBrushSelectionParams';

export type MosaicDashboardVgPlotChartProps = ChartPanelRendererProps & {
  tableName: string;
  spec: UseGenerateSpecResult;
};

export const MosaicDashboardVgPlotChart: FC<
  MosaicDashboardVgPlotChartProps
> = ({panel, dashboardId, selectionName, spec}) => {
  const retention = useChartRetainer(dashboardId, panel.id);
  const params = useBrushSelectionParams(selectionName);

  if (spec.error) {
    return <MosaicDashboardVgPlotError error={spec.error} />;
  }

  return <VgPlotChart spec={spec.spec} params={params} retention={retention} />;
};
