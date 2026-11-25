import {type QualifiedTableName, type TableColumn} from '@sqlrooms/db';
import {getColumnTypeCategory} from '@sqlrooms/duckdb';
import {column, literal, Query, sql} from '@uwdata/mosaic-sql';
import {getMosaicSqlTableReference} from '../../../mosaicTableReference';

const DECIMAL_TYPE = /^DECIMAL\((\d+),\s*\d+\)$/;
const EXACT_QUANTILE_TYPES = new Set([
  'BIGINT',
  'UBIGINT',
  'HUGEINT',
  'UHUGEINT',
  'TIMESTAMP_NS',
  'BIT',
  'INTERVAL',
]);

function getBoundType(field: TableColumn): string {
  const type = field.type.trim().toUpperCase();
  if (DECIMAL_TYPE.test(type)) return type;
  if (/^BIT\b/.test(type)) return 'BIT';
  if (EXACT_QUANTILE_TYPES.has(type) || type === 'TIME') return type;
  if (getColumnTypeCategory(field) === 'number') return 'DOUBLE';
  if (type === 'TIMETZ' || type === 'TIME WITH TIME ZONE') return 'TIMETZ';
  return /TIMESTAMPTZ|WITH TIME ZONE/.test(type) ? 'TIMESTAMPTZ' : 'TIMESTAMP';
}

/**
 * Build the source-wide cutoff and the trimmed mark source. The bound is read
 * as text so Arrow does not round high-precision timestamps or decimals.
 */
export function createHistogramPercentileQueries(
  table: QualifiedTableName,
  field: TableColumn,
  percentile: number,
) {
  const tableRef = getMosaicSqlTableReference(table);
  const input = column(field.name);
  const type = getBoundType(field);
  const finite = ['BIT', 'INTERVAL', 'TIME', 'TIMETZ'].includes(type)
    ? sql`${input} IS NOT NULL`
    : sql`ISFINITE(${input})`;
  const decimalWidth = Number(DECIMAL_TYPE.exec(type)?.[1] ?? 0);
  // DuckDB interpolates 128-bit decimals through DOUBLE.
  const useDiscreteQuantile =
    EXACT_QUANTILE_TYPES.has(type) || decimalWidth > 18;
  const quantile = useDiscreteQuantile
    ? sql`QUANTILE_DISC(${input}, ${percentile / 100})`
    : sql`QUANTILE_CONT(${input}, ${percentile / 100})`;
  const cutoff =
    decimalWidth > 0 && !useDiscreteQuantile
      ? sql`GREATEST(MIN(${input}), ${quantile})`
      : quantile;

  return {
    cutoff: Query.from(tableRef)
      .select({upper_bound: sql`CAST(${cutoff} AS VARCHAR)`})
      .where(finite),
    source: (bound?: string) => {
      const limit =
        bound === undefined
          ? sql`(${Query.from(tableRef).select({upper_bound: cutoff}).where(finite)})`
          : sql`CAST(${literal(bound)} AS ${type})`;
      return Query.from(tableRef)
        .select('*')
        .where(finite, sql`${input} <= ${limit}`);
    },
  };
}
