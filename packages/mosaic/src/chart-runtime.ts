import {DataPointLimitError} from './DataPointLimitError';

export type ChartDataPolicy = {
  /**
   * Disable runtime row-count validation for charts whose query result size
   * does not correspond to rendered data points.
   */
  disabled?: boolean;
  /** Maximum allowed result rows for this chart's runtime query results. */
  maxRows?: number;
  /** Short explanation shown to users and assistants when the policy trips. */
  reason?: string;
  /** Optional custom size estimator for renderer-specific result shapes. */
  getResultSize?: (result: unknown) => number;
};

export type ChartDataPolicyContext<TConfig> = {
  tableName: string;
  config: TConfig;
  maxDataPoints: number;
};

export type ChartRuntimeIssueKind =
  | 'too-much-data'
  | 'sql-error'
  | 'render-error';

export type ChartRuntimeIssue = {
  kind: ChartRuntimeIssueKind;
  panelId: string;
  chartType: string;
  message: string;
  recoverable: boolean;
  rowCount?: number;
  limit?: number;
  sql?: string;
};

export type ChartRuntimeIssueContext = {
  panelId: string;
  chartType: string;
};

export type ChartRuntimeIssueReporter = {
  reportIssue: (issue: ChartRuntimeIssue) => void;
  clearIssue: () => void;
};

export function getQueryResultRowCount(result: unknown): number {
  if (!result) return 0;

  if (typeof result === 'object' && 'numRows' in result) {
    return (result as {numRows?: number}).numRows ?? 0;
  }

  if (Array.isArray(result)) {
    return result.length;
  }

  if (
    typeof result === 'object' &&
    'toArray' in result &&
    typeof (result as {toArray?: unknown}).toArray === 'function'
  ) {
    const arr = (result as {toArray: () => unknown}).toArray();
    return Array.isArray(arr) ? arr.length : 0;
  }

  console.warn(
    'getQueryResultRowCount: unrecognized result format, expected Arrow table (numRows), array, or table-like object with toArray()',
    {
      type: typeof result,
      isArray: Array.isArray(result),
      hasToArray:
        typeof result === 'object' &&
        result !== null &&
        'toArray' in result &&
        typeof (result as {toArray?: unknown}).toArray === 'function',
    },
  );
  return 0;
}

export function assertChartDataPolicy(
  policy: ChartDataPolicy | null | undefined,
  result: unknown,
): void {
  if (!policy || policy.disabled || policy.maxRows == null) {
    return;
  }

  const rowCount = policy.getResultSize
    ? policy.getResultSize(result)
    : getQueryResultRowCount(result);

  if (rowCount > policy.maxRows) {
    throw new DataPointLimitError(rowCount, policy.maxRows);
  }
}

export function createChartRuntimeIssueFromError(
  error: unknown,
  context: ChartRuntimeIssueContext,
  policy?: ChartDataPolicy | null,
): ChartRuntimeIssue {
  const message = error instanceof Error ? error.message : String(error);

  if (error instanceof DataPointLimitError) {
    return {
      kind: 'too-much-data',
      panelId: context.panelId,
      chartType: context.chartType,
      message: policy?.reason ? `${message}\n${policy.reason}` : message,
      recoverable: true,
      rowCount: error.rowCount,
      limit: error.limit,
    };
  }

  return {
    kind: 'sql-error',
    panelId: context.panelId,
    chartType: context.chartType,
    message,
    recoverable: true,
  };
}
