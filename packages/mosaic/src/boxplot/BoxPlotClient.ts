import {
  MosaicClient,
  clauseInterval,
  type Selection,
} from '@uwdata/mosaic-core';
import type {ExprNode, FilterExpr} from '@uwdata/mosaic-sql';

export type BoxPlotSummaryRow = {
  category: unknown;
  count: number;
  lowerFence: number;
  median: number;
  q1: number;
  q3: number;
  upperFence: number;
  whiskerHigh: number;
  whiskerLow: number;
};

export type BoxPlotOutlierRow = {
  category: unknown;
  value: number;
};

export type BoxPlotState = {
  error?: Error;
  isLoading: boolean;
  outliers: BoxPlotOutlierRow[];
  summaries: BoxPlotSummaryRow[];
  yBrush?: [number, number];
};

export type BoxPlotClientOptions = {
  onStateChange: (state: BoxPlotState) => void;
  selection: Selection;
  tableName: string;
  x: string;
  y: string;
};

type BoxPlotQueryRow = Partial<BoxPlotSummaryRow & BoxPlotOutlierRow> & {
  rowKind?: 'summary' | 'outlier';
};

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function quoteTableReference(tableName: string): string {
  return tableName.split('.').map(quoteIdentifier).join('.');
}

function normalizeFilter(filter?: FilterExpr | null): string[] {
  if (!filter) {
    return [];
  }
  const filters = Array.isArray(filter) ? filter.flat(Infinity) : [filter];
  return filters
    .map((expr) => {
      if (typeof expr === 'boolean') {
        return expr ? null : 'FALSE';
      }
      return `(${(expr as string | ExprNode).toString()})`;
    })
    .filter((expr): expr is string => Boolean(expr));
}

/**
 * Type guard to check if data has a toArray method.
 */
function hasToArrayMethod(data: unknown): data is {toArray: () => unknown} {
  return (
    data !== null &&
    data !== undefined &&
    typeof data === 'object' &&
    'toArray' in data &&
    typeof (data as Record<string, unknown>).toArray === 'function'
  );
}

/**
 * Safely extract rows from query result data.
 * Handles both direct arrays and objects with toArray() method.
 * Returns empty array if data is invalid or doesn't have expected structure.
 */
function rowsFromQueryResult<T>(data: unknown): T[] {
  // Handle direct arrays
  if (Array.isArray(data)) {
    return data as T[];
  }

  // Handle objects with toArray() method (Arrow Tables, Mosaic results, etc.)
  if (!hasToArrayMethod(data)) {
    return [];
  }

  try {
    const result = data.toArray();

    // Validate that toArray() returned an array
    if (!Array.isArray(result)) {
      console.warn(
        'BoxPlotClient: toArray() did not return an array',
        typeof result,
      );
      return [];
    }

    return result as T[];
  } catch (error) {
    console.error('BoxPlotClient: Error calling toArray():', error);
    return [];
  }
}

function numericValue(value: unknown): number | undefined {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

export function buildBoxPlotQuery(args: {
  filter?: FilterExpr | null;
  tableName: string;
  x: string;
  y: string;
}): string {
  const table = quoteTableReference(args.tableName);
  const x = quoteIdentifier(args.x);
  const y = quoteIdentifier(args.y);
  const filters = normalizeFilter(args.filter).join(' AND ');
  const where = [`${y} IS NOT NULL`, filters].filter(Boolean).join(' AND ');

  return `
WITH base AS (
  SELECT
    ${x} AS "category",
    TRY_CAST(${y} AS DOUBLE) AS "value"
  FROM ${table}
  WHERE ${where}
),
stats AS (
  SELECT
    "category",
    COUNT(*)::DOUBLE AS "count",
    quantile_cont("value", 0.25) AS "q1",
    quantile_cont("value", 0.5) AS "median",
    quantile_cont("value", 0.75) AS "q3"
  FROM base
  WHERE "value" IS NOT NULL
  GROUP BY "category"
),
fences AS (
  SELECT
    *,
    "q1" - 1.5 * ("q3" - "q1") AS "lowerFence",
    "q3" + 1.5 * ("q3" - "q1") AS "upperFence"
  FROM stats
),
whiskers AS (
  SELECT
    b."category",
    MIN(b."value") AS "whiskerLow",
    MAX(b."value") AS "whiskerHigh"
  FROM base b
  JOIN fences f ON b."category" IS NOT DISTINCT FROM f."category"
  WHERE b."value" BETWEEN f."lowerFence" AND f."upperFence"
  GROUP BY b."category"
),
summary AS (
  SELECT
    'summary' AS "rowKind",
    f."category",
    f."count",
    f."q1",
    f."median",
    f."q3",
    f."lowerFence",
    f."upperFence",
    w."whiskerLow",
    w."whiskerHigh",
    NULL::DOUBLE AS "value"
  FROM fences f
  JOIN whiskers w ON w."category" IS NOT DISTINCT FROM f."category"
),
outliers AS (
  SELECT
    'outlier' AS "rowKind",
    b."category",
    NULL::DOUBLE AS "count",
    NULL::DOUBLE AS "q1",
    NULL::DOUBLE AS "median",
    NULL::DOUBLE AS "q3",
    NULL::DOUBLE AS "lowerFence",
    NULL::DOUBLE AS "upperFence",
    NULL::DOUBLE AS "whiskerLow",
    NULL::DOUBLE AS "whiskerHigh",
    b."value"
  FROM base b
  JOIN fences f ON b."category" IS NOT DISTINCT FROM f."category"
  WHERE b."value" < f."lowerFence" OR b."value" > f."upperFence"
)
SELECT * FROM summary
UNION ALL
SELECT * FROM outliers
ORDER BY "category", "rowKind", "value"
`.trim();
}

export class BoxPlotClient extends MosaicClient {
  private readonly onStateChange: (state: BoxPlotState) => void;
  private readonly tableName: string;
  private readonly x: string;
  private readonly y: string;
  private state: BoxPlotState = {
    isLoading: true,
    outliers: [],
    summaries: [],
  };
  private destroyed = false;

  constructor(options: BoxPlotClientOptions) {
    super(options.selection);
    this.onStateChange = options.onStateChange;
    this.tableName = options.tableName;
    this.x = options.x;
    this.y = options.y;
  }

  override get filterStable(): boolean {
    return false;
  }

  private emitState(next: Partial<BoxPlotState>) {
    if (this.destroyed) {
      return;
    }
    this.state = {...this.state, ...next};
    this.onStateChange(this.state);
  }

  override queryPending(): this {
    this.emitState({error: undefined, isLoading: true});
    return this;
  }

  override query(filter?: FilterExpr | null): string {
    return buildBoxPlotQuery({
      filter,
      tableName: this.tableName,
      x: this.x,
      y: this.y,
    });
  }

  override queryResult(data: unknown): this {
    const rows = rowsFromQueryResult<BoxPlotQueryRow>(data);
    const summaries: BoxPlotSummaryRow[] = [];
    const outliers: BoxPlotOutlierRow[] = [];

    for (const row of rows) {
      if (row.rowKind === 'summary') {
        const count = numericValue(row.count);
        const q1 = numericValue(row.q1);
        const median = numericValue(row.median);
        const q3 = numericValue(row.q3);
        const lowerFence = numericValue(row.lowerFence);
        const upperFence = numericValue(row.upperFence);
        const whiskerLow = numericValue(row.whiskerLow);
        const whiskerHigh = numericValue(row.whiskerHigh);
        if (
          count === undefined ||
          q1 === undefined ||
          median === undefined ||
          q3 === undefined ||
          lowerFence === undefined ||
          upperFence === undefined ||
          whiskerLow === undefined ||
          whiskerHigh === undefined
        ) {
          continue;
        }
        summaries.push({
          category: row.category,
          count,
          lowerFence,
          median,
          q1,
          q3,
          upperFence,
          whiskerHigh,
          whiskerLow,
        });
      } else if (row.rowKind === 'outlier') {
        const value = numericValue(row.value);
        if (value !== undefined) {
          outliers.push({
            category: row.category,
            value,
          });
        }
      }
    }

    this.emitState({
      error: undefined,
      isLoading: false,
      outliers,
      summaries,
    });
    return this;
  }

  override queryError(error: Error): this {
    this.emitState({error, isLoading: false});
    return this;
  }

  updateYBrush(extent?: [number, number]) {
    const normalized = extent
      ? ([Math.min(...extent), Math.max(...extent)] as [number, number])
      : undefined;
    this.emitState({yBrush: normalized});
    this.filterBy?.update(
      clauseInterval(this.y, normalized ?? null, {source: this}),
    );
  }

  reset() {
    this.updateYBrush();
  }

  override destroy() {
    this.destroyed = true;
    super.destroy();
  }
}
