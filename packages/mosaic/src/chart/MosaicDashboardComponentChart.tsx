import React, {FC} from 'react';
import {
  ComponentChartTypeDefinition,
  ChartRetainer,
  BrushSelectionParams,
} from '../chart-types/base-types';
import type {ChartPanelConfig} from '../dashboard/dashboard-types';
import {MosaicReadyConnection} from '../MosaicSlice';
import type {
  ChartDataPolicy,
  ChartRuntimeIssueContext,
  ChartRuntimeIssueReporter,
} from '../chart-runtime';

export type MosaicDashboardComponentChartProps = {
  tableName: string;
  panel: ChartPanelConfig;
  chartTypeDefinition: ComponentChartTypeDefinition;
  connection: MosaicReadyConnection;
  retention: ChartRetainer;
  params: BrushSelectionParams | undefined;
  dataPolicy?: ChartDataPolicy | null;
  runtimeIssueContext: ChartRuntimeIssueContext;
  runtimeIssueReporter: ChartRuntimeIssueReporter;
};

export const MosaicDashboardComponentChart: FC<
  MosaicDashboardComponentChartProps
> = ({
  tableName,
  panel,
  chartTypeDefinition,
  connection,
  retention,
  params,
  dataPolicy,
  runtimeIssueContext,
  runtimeIssueReporter,
}) => {
  return React.createElement(chartTypeDefinition.renderer, {
    tableName,
    config: panel.config,
    coordinator: connection.coordinator,
    params,
    retention,
    dataPolicy,
    runtimeIssueContext,
    runtimeIssueReporter,
  });
};
