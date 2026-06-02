import {SpinnerPane, cn} from '@sqlrooms/ui';
import {type FC, createElement, useMemo} from 'react';
import {VgPlotChart} from '../VgPlotChart';
import type {ChartRuntimeIssueContext} from '../chart-runtime';
import type {ChartConfig} from './chart-types/chart-config';
import {useStoreWithMosaicDashboard} from '../dashboard/MosaicDashboardSlice';
import {MosaicChartRuntimeIssuePanel} from './MosaicChartRuntimeIssuePanel';
import {MosaicChartError} from './MosaicChartError';
import {useBrushSelectionParams} from './useBrushSelectionParams';
import {useChartDataPolicy} from './useChartDataPolicy';
import {useChartRetainerByKey} from './useChartRetainer';
import {useMosaicChartRenderContext} from './useMosaicChartRenderContext';
import {useRuntimeIssueReporter} from './useRuntimeIssueReporter';

export type MosaicChartViewProps = {
  tableName?: string;
  config: ChartConfig;
  selectionName?: string;
  retentionKey?: string;
  runtimeIssueKey?: string;
  className?: string;
};

export const MosaicChartView: FC<MosaicChartViewProps> = ({
  tableName,
  config,
  selectionName,
  retentionKey,
  runtimeIssueKey,
  className,
}) => {
  const connection = useStoreWithMosaicDashboard(
    (state) => state.mosaic.connection,
  );

  const retention = useChartRetainerByKey(retentionKey);
  const params = useBrushSelectionParams(selectionName);
  const dataPolicy = useChartDataPolicy(tableName, config);

  const runtimeIssueReporter = useRuntimeIssueReporter(runtimeIssueKey);

  const runtimeIssueContext: ChartRuntimeIssueContext = useMemo(
    () => ({
      panelId: runtimeIssueKey ?? retentionKey ?? config.chartType,
      chartType: config.chartType,
    }),
    [config.chartType, retentionKey, runtimeIssueKey],
  );

  const issue = useStoreWithMosaicDashboard((state) =>
    runtimeIssueKey
      ? state.mosaicDashboard.getPanelIssueByKey(runtimeIssueKey)
      : undefined,
  );

  const renderContext = useMosaicChartRenderContext(tableName, config);

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
    return <MosaicChartRuntimeIssuePanel issue={issue} />;
  }

  if (renderContext.type === 'error') {
    return (
      <div
        className={cn(
          'flex h-full flex-col items-center justify-center',
          className,
        )}
      >
        <MosaicChartError
          title={renderContext.title}
          message={renderContext.message}
        />
      </div>
    );
  }

  if (renderContext.type === 'spec') {
    return (
      <div className={cn('h-full w-full', className)}>
        <VgPlotChart
          spec={renderContext.spec}
          params={params}
          retention={retention}
          dataPolicy={dataPolicy}
          runtimeIssueContext={runtimeIssueContext}
          runtimeIssueReporter={runtimeIssueReporter}
        />
      </div>
    );
  }

  if (renderContext.type === 'component') {
    return (
      <div className={cn('h-full w-full', className)}>
        {createElement(renderContext.renderer, {
          tableName: renderContext.tableName,
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

  return null;
};
