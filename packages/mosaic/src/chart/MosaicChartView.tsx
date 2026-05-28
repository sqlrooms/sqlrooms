import {SpinnerPane, cn} from '@sqlrooms/ui';
import {type FC, createElement, useMemo} from 'react';
import {VgPlotChart} from '../VgPlotChart';
import type {
  ChartRuntimeIssue,
  ChartRuntimeIssueContext,
} from '../chart-runtime';
import {resolveChartDataPolicy} from '../chart-runtime';
import {
  isComponentChartType,
  isSpecChartType,
  type ChartTypeDefinition,
} from '../chart-types/base-types';
import type {ChartConfig} from '../chart-types/chart-config';
import {useChartTypeDefinition} from '../chart-types/useChartTypeDefinition';
import {useStoreWithMosaicDashboard} from '../dashboard/MosaicDashboardSlice';
import {ChartRuntimeIssuePanel} from './ChartRuntimeIssuePanel';
import {MosaicDashboardVgPlotError} from './MosaicDashboardVgPlotError';
import {useBrushSelectionParams} from './useBrushSelectionParams';
import {useChartRetainerByKey} from './useChartRetainer';
import {useGenerateSpec} from './useGenerateSpec';

export type MosaicChartViewProps = {
  tableName: string;
  config: ChartConfig;
  selectionName?: string;
  retentionKey?: string;
  runtimeIssueKey?: string;
  chartTypeDefinition?: ChartTypeDefinition;
  className?: string;
};

function useRuntimeIssueReporter(runtimeIssueKey: string | undefined) {
  const reportPanelIssueByKey = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.reportPanelIssueByKey,
  );
  const clearPanelIssueByKey = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.clearPanelIssueByKey,
  );

  return useMemo(
    () => ({
      reportIssue: (issueToReport: ChartRuntimeIssue) => {
        if (runtimeIssueKey) {
          reportPanelIssueByKey(runtimeIssueKey, issueToReport);
        }
      },
      clearIssue: () => {
        if (runtimeIssueKey) {
          clearPanelIssueByKey(runtimeIssueKey);
        }
      },
    }),
    [clearPanelIssueByKey, reportPanelIssueByKey, runtimeIssueKey],
  );
}

export const MosaicChartView: FC<MosaicChartViewProps> = ({
  tableName,
  config,
  selectionName,
  retentionKey,
  runtimeIssueKey,
  chartTypeDefinition,
  className,
}) => {
  const connection = useStoreWithMosaicDashboard(
    (state) => state.mosaic.connection,
  );
  const registeredChartTypeDefinition = useChartTypeDefinition(
    config.chartType,
  );
  const resolvedChartTypeDefinition =
    chartTypeDefinition ?? registeredChartTypeDefinition;
  const spec = useGenerateSpec(
    tableName,
    config.settings,
    resolvedChartTypeDefinition,
  );
  const retention = useChartRetainerByKey(retentionKey);
  const params = useBrushSelectionParams(selectionName);
  const issue = useStoreWithMosaicDashboard((state) =>
    runtimeIssueKey
      ? state.mosaicDashboard.getPanelIssueByKey(runtimeIssueKey)
      : undefined,
  );
  const runtimeIssueReporter = useRuntimeIssueReporter(runtimeIssueKey);
  const runtimeIssueContext: ChartRuntimeIssueContext = useMemo(
    () => ({
      panelId: runtimeIssueKey ?? retentionKey ?? config.chartType,
      chartType: config.chartType,
    }),
    [config.chartType, retentionKey, runtimeIssueKey],
  );
  const dataPolicy = useMemo(() => {
    const defaultPolicy =
      resolvedChartTypeDefinition?.getDataPolicy?.({tableName, config}) ?? null;
    return resolveChartDataPolicy(defaultPolicy, config.dataPolicy);
  }, [config, resolvedChartTypeDefinition, tableName]);

  if (!resolvedChartTypeDefinition) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        Unknown chart type: {config.chartType}
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

  if (issue) {
    return <ChartRuntimeIssuePanel issue={issue} />;
  }

  if (isSpecChartType(resolvedChartTypeDefinition)) {
    if (spec.error) {
      return (
        <div className="flex h-full flex-col items-center justify-center">
          <MosaicDashboardVgPlotError error={spec.error} />
        </div>
      );
    }

    return (
      <div className={cn('h-full w-full', className)}>
        <VgPlotChart
          spec={spec.spec}
          params={params}
          retention={retention}
          dataPolicy={dataPolicy}
          runtimeIssueContext={runtimeIssueContext}
          runtimeIssueReporter={runtimeIssueReporter}
        />
      </div>
    );
  }

  if (isComponentChartType(resolvedChartTypeDefinition)) {
    return (
      <div className={cn('h-full w-full', className)}>
        {createElement(resolvedChartTypeDefinition.renderer, {
          tableName,
          config,
          coordinator: connection.coordinator,
          params,
          retention,
          dataPolicy,
          runtimeIssueContext,
          runtimeIssueReporter,
        })}
      </div>
    );
  }

  throw new Error('Unsupported chart type definition');
};
