import {Tool} from 'ai';
import {DatabaseAiAdapter} from '../../ai';
import {ToolOutput} from '../../ai/tool-types';

export type ChartToolOutput<T> = ToolOutput<{
  details: string;
  data: T;
}>;

type AddChartFunctionArgs = {
  tableName: string;
  title: string;
  config: any;
};

export type AddChartFunction = (args: AddChartFunctionArgs) => string;

/**
 * Dependencies for chart configuration tools.
 * Simple and minimal.
 */
export type ChartToolParams = {
  /** Add chart to dashboard */
  addChart: AddChartFunction;
  /** Maximum data points for non-aggregated charts */
  maxDataPoints: number;
  /** Database adapter for resolving tables and columns. */
  databaseAdapter: DatabaseAiAdapter;
};

/**
 * Factory for creating chart configuration tools.
 * Chart tools generate ChartConfig and use resolveTable for validation.
 */
export type ChartToolFactory<TInput, TOutput> = (
  params: ChartToolParams,
) => Tool<TInput, ChartToolOutput<TOutput>>;
