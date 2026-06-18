import {Tool} from 'ai';
import {BaseMosaicAiAdapter} from '../../ai';

export type ChartToolErrorOutput = {
  llmResult: {
    success: false;
    errorMessage?: string;
  };
};

export type ChartToolSuccessOutput<T> = {
  llmResult: {
    success: true;
    details?: string;
    data?: T;
  };
};

export type ChartToolOutput<T> =
  | ChartToolSuccessOutput<T>
  | ChartToolErrorOutput;

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
export type ChartToolDeps = {
  /** Add chart to dashboard */
  addChart: AddChartFunction;
  /** Maximum data points for non-aggregated charts */
  maxDataPoints: number;
  /** Adapter */
  adapter: BaseMosaicAiAdapter;
};

/**
 * Factory for creating chart configuration tools.
 * Chart tools generate ChartConfig and use resolveTable for validation.
 */
export type ChartToolFactory<TInput, TOutput> = (
  deps: ChartToolDeps,
) => Tool<TInput, ChartToolOutput<TOutput>>;
