import {ChartConfig} from '../charts/chart-types/chart-config';
import type {ChartBuilderColumn} from '../charts/chart-types/base-types';

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
  config: ChartConfig;
}

export interface CreateChartResult {
  panelId: string;
  artifactId: string;
  tableName: string;
  title: string;
  config: ChartConfig;
}
