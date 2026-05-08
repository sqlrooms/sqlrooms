import type {ChartBuilderColumn} from './base-types';
import {VgPlotChartConfig} from './chart-config';

export interface ResolvedChartResourcesParams {
  artifactId?: string;
  tableName?: string;
  createArtifactIfMissing?: boolean;
}

export interface ResolvedChartResources {
  artifactId: string;
  tableName: string;
  columns: ChartBuilderColumn[];
}

export interface CreateChartParams {
  artifactId: string;
  tableName: string;
  title: string;
  config: VgPlotChartConfig;
}

export interface CreateChartResult {
  panelId: string;
  artifactId: string;
  tableName: string;
  title: string;
  config: VgPlotChartConfig;
}

export interface ChartToolDeps {
  resolveResources: (
    params: ResolvedChartResourcesParams,
  ) => ResolvedChartResources;
  createChart: (params: CreateChartParams) => CreateChartResult;
}
