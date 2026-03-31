import {
  escapeId,
  separateLastStatement,
  joinStatements,
} from '@sqlrooms/duckdb';
import {TimeScale} from './types';

export type YAggregate = 'sum' | 'mean' | 'count';

/**
 * Wraps a query with datetime binning transformation using DuckDB's DATE_TRUNC.
 * Uses CTE pattern to safely wrap any query structure.
 * Converts truncated timestamps to ISO 8601 strings via CAST AS VARCHAR.
 * Vega-Lite parses these strings with format.parse and formats them per axis spec.
 *
 * @param query - Base SQL query
 * @param xField - DateTime field to bin
 * @param timeScale - Time scale for binning (minute, hour, day, month, year)
 * @param yField - Field to aggregate (optional for count)
 * @param yAggregate - Aggregation function (sum, mean, count)
 * @returns Transformed query with datetime binning
 *
 * @example
 * const query = 'SELECT timestamp, value FROM table';
 * const result = wrapQueryWithDateTimeBinning(query, 'timestamp', 'day', 'value', 'sum');
 * // Returns:
 * // WITH _vega_base AS (
 * //   SELECT timestamp, value FROM table
 * // )
 * // SELECT
 * //   CAST(DATE_TRUNC('day', "timestamp") AS VARCHAR) AS "timestamp",
 * //   SUM("value") AS "value"
 * // FROM _vega_base
 * // GROUP BY DATE_TRUNC('day', "timestamp")
 * // ORDER BY DATE_TRUNC('day', "timestamp")
 */
export function wrapQueryWithDateTimeBinning(
  query: string,
  xField: string,
  timeScale: TimeScale,
  yField: string | undefined,
  yAggregate: YAggregate,
): string {
  const {precedingStatements, lastStatement} = separateLastStatement(query);

  // Build the CTE wrapping the base query
  const cte = `WITH _vega_base AS (
  ${lastStatement}
)`;

  // Build the aggregation expression
  const truncatedXField = `DATE_TRUNC('${timeScale}', ${escapeId(xField)})`;

  // Convert to ISO 8601 string format for reliable Vega-Lite parsing
  const isoXField = `CAST(${truncatedXField} AS VARCHAR)`;

  let aggregateExpr: string;

  if (yAggregate === 'count') {
    // COUNT(*) - no field needed
    aggregateExpr = `COUNT(*) AS ${escapeId('count')}`;
  } else if (yField) {
    // SUM or MEAN with a field
    const aggFunc = yAggregate === 'sum' ? 'SUM' : 'AVG';
    aggregateExpr = `${aggFunc}(${escapeId(yField)}) AS ${escapeId(yField)}`;
  } else {
    // Fallback: if no yField but not count, default to COUNT(*)
    aggregateExpr = `COUNT(*) AS ${escapeId('count')}`;
  }

  // Build the final SELECT - return ISO string
  const finalSelect = `SELECT
  ${isoXField} AS ${escapeId(xField)},
  ${aggregateExpr}
FROM _vega_base
GROUP BY ${truncatedXField}
ORDER BY ${truncatedXField}`;

  // Combine: preceding statements + CTE + final SELECT
  return joinStatements(precedingStatements, `${cte}\n${finalSelect}`);
}
