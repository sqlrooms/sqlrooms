import {FC} from 'react';
import {UseGenerateSpecResult} from './useGenerateSpec';
import {MosaicDashboardVgPlotError} from './MosaicDashboardVgPlotError';
import {VgPlotChart} from '../VgPlotChart';
import {ChartRetainer, BrushSelectionParams} from '../chart-types/base-types';
import type {
  ChartDataPolicy,
  ChartRuntimeIssueContext,
  ChartRuntimeIssueReporter,
} from '../chart-runtime';

export type MosaicDashboardVgPlotChartProps = {
  spec: UseGenerateSpecResult;
  retention: ChartRetainer;
  params: BrushSelectionParams | undefined;
  dataPolicy?: ChartDataPolicy | null;
  runtimeIssueContext: ChartRuntimeIssueContext;
  runtimeIssueReporter: ChartRuntimeIssueReporter;
};

export const MosaicDashboardVgPlotChart: FC<
  MosaicDashboardVgPlotChartProps
> = ({
  spec,
  retention,
  params,
  dataPolicy,
  runtimeIssueContext,
  runtimeIssueReporter,
}) => {
  if (spec.error) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <MosaicDashboardVgPlotError error={spec.error} />
      </div>
    );
  }

  return (
    <VgPlotChart
      spec={spec.spec}
      params={params}
      retention={retention}
      dataPolicy={dataPolicy}
      runtimeIssueContext={runtimeIssueContext}
      runtimeIssueReporter={runtimeIssueReporter}
    />
  );
};
