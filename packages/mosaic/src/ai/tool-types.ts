import {ChartConfig} from '../charts/chart-types/chart-config';
import type {ChartBuilderColumn} from '../charts/chart-types/column-types';

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

type ToolOutputDefaultError = {errorMessage?: string};

export type ToolOutput<
  TSuccess,
  TError extends ToolOutputDefaultError = ToolOutputDefaultError,
> =
  | ({
      success: true;
    } & TSuccess)
  | ({
      success: false;
    } & TError);

/**
 * Metadata about agent execution.
 * Tracks statistics like steps executed and queries run during agent operation.
 */
export type AgentResultMetadata = {
  tableName?: string;
  stepsExecuted: number;
  queriesRun: number;
  skillsApplied?: Array<{
    id: string;
    rootId: string;
  }>;
};
