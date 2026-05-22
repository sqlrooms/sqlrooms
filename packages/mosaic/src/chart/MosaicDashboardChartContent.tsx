import {type FC, useMemo} from 'react';
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
import {useStoreWithMosaicDashboard} from '../dashboard/MosaicDashboardSlice';
import {ChartRuntimeIssuePanel} from './ChartRuntimeIssuePanel';
import {resolveChartDataPolicy, type ChartRuntimeIssue} from '../chart-runtime';

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
  const maxDataPoints = useStoreWithMosaicDashboard(
    (state) => state.mosaic.config.maxDataPoints,
  );
  const issue = useStoreWithMosaicDashboard((state) =>
    state.mosaicDashboard.getPanelIssue(dashboardId, panel.id),
  );
  const reportPanelIssue = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.reportPanelIssue,
  );
  const clearPanelIssue = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.clearPanelIssue,
  );
  const dataPolicy = useMemo(() => {
    const defaultPolicy =
      chartTypeDefinition.getDataPolicy?.({
        tableName,
        config: panel.config,
        maxDataPoints: maxDataPoints ?? 10000,
      }) ?? null;
    return resolveChartDataPolicy(defaultPolicy, panel.config.dataPolicy);
  }, [chartTypeDefinition, maxDataPoints, panel.config, tableName]);
  const runtimeIssueReporter = useMemo(
    () => ({
      reportIssue: (issueToReport: ChartRuntimeIssue) => {
        reportPanelIssue(dashboardId, panel.id, issueToReport);
      },
      clearIssue: () => clearPanelIssue(dashboardId, panel.id),
    }),
    [clearPanelIssue, dashboardId, panel.id, reportPanelIssue],
  );
  const runtimeIssueContext = useMemo(
    () => ({
      panelId: panel.id,
      chartType: panel.config.chartType,
    }),
    [panel.config.chartType, panel.id],
  );

  if (issue) {
    return <ChartRuntimeIssuePanel issue={issue} />;
  }

  if (isSpecChartType(chartTypeDefinition)) {
    return (
      <MosaicDashboardVgPlotChart
        spec={spec}
        retention={retention}
        params={params}
        dataPolicy={dataPolicy}
        runtimeIssueReporter={runtimeIssueReporter}
        runtimeIssueContext={runtimeIssueContext}
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
        dataPolicy={dataPolicy}
        runtimeIssueContext={runtimeIssueContext}
        runtimeIssueReporter={runtimeIssueReporter}
      />
    );
  }

  throw new Error('Unsupported chart type definition');
};
