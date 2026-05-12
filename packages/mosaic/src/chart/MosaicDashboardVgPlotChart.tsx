import {FC} from 'react';
import {UseGenerateSpecResult} from './useGenerateSpec';
import {MosaicDashboardVgPlotError} from './MosaicDashboardVgPlotError';
import {VgPlotChart} from '../VgPlotChart';
import {ChartRetainer, BrushSelectionParams} from '../chart-types/base-types';

export type MosaicDashboardVgPlotChartProps = {
  spec: UseGenerateSpecResult;
  retention: ChartRetainer;
  params: BrushSelectionParams | undefined;
};

export const MosaicDashboardVgPlotChart: FC<
  MosaicDashboardVgPlotChartProps
> = ({spec, retention, params}) => {
  if (spec.error) {
    return <MosaicDashboardVgPlotError error={spec.error} />;
  }

  return <VgPlotChart spec={spec.spec} params={params} retention={retention} />;
};
