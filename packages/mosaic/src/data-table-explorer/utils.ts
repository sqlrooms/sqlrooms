import {
  getArrowColumnTypeCategory,
  getDuckDbTypeCategory,
} from '@sqlrooms/duckdb';
import type {FieldInfo} from '@uwdata/mosaic-core';
import {asc, column, count, desc, Query, sql, sum} from '@uwdata/mosaic-sql';
import * as arrow from 'apache-arrow';
import type {
  DataTableExplorerBin,
  DataTableExplorerCategoryBucket,
  DataTableExplorerColumnKind,
  DataTableExplorerColumnKindOverride,
  DataTableExplorerPaginationState,
  DataTableExplorerSqlTableReference,
  DataTableExplorerSorting,
  DataTableExplorerSummaryState,
} from './types';

export type CategoryCountRow = {
  bucketKind: 'null' | 'unique' | 'value';
  total: number;
  typedValue: unknown;
};

type QueryWhereInput = Parameters<ReturnType<typeof Query.from>['where']>[0];

export function isDataTableExplorerHistogramType(
  type: arrow.DataType,
): boolean {
  const category = getArrowColumnTypeCategory(type);
  return category === 'datetime' || category === 'number';
}

export function isDataTableExplorerUnsupportedSummaryType(
  type: arrow.DataType,
): boolean {
  const category = getArrowColumnTypeCategory(type);
  return category === 'binary' || category === 'geometry';
}

/**
 * Resolves the effective summary kind for a column, combining the default
 * Arrow-type-driven behavior with an optional user override.
 *
 * `'none'` is always honored. `'category'` and `'histogram'` are honored only
 * when the column type supports them; incompatible requests fall back to the
 * type-driven default so a bad override can not produce broken summary
 * queries.
 */
export function resolveDataTableExplorerColumnKind(
  field: arrow.Field,
  getColumnKind?: (field: arrow.Field) => DataTableExplorerColumnKindOverride,
): DataTableExplorerColumnKind {
  const autoKind: DataTableExplorerColumnKind =
    isDataTableExplorerUnsupportedSummaryType(field.type)
      ? 'unsupported'
      : isDataTableExplorerHistogramType(field.type)
        ? 'histogram'
        : 'category';

  const override = getColumnKind?.(field) ?? 'auto';
  if (override === 'auto') {
    return autoKind;
  }
  if (override === 'none') {
    return 'none';
  }
  if (autoKind === 'unsupported') {
    return autoKind;
  }
  if (override === 'histogram' && autoKind !== 'histogram') {
    return autoKind;
  }
  return override;
}

export function getDataTableExplorerValueType(
  type: arrow.DataType,
): 'date' | 'number' | 'string' {
  const category = getArrowColumnTypeCategory(type);
  if (category === 'datetime') {
    return 'date';
  }
  if (category === 'number') {
    return 'number';
  }
  return 'string';
}

/**
 * Builds a one-row schema probe query for a dataTableExplorer table.
 *
 * @param tableName Table reference to query. Pass a TableRefNode when the table
 * reference is qualified or contains dotted identifier parts.
 * @param columns Optional list of columns to include; when omitted, the query
 * selects all columns.
 * @returns Mosaic query used to infer Arrow field metadata from the table.
 */
export function buildSchemaQuery(
  tableName: DataTableExplorerSqlTableReference,
  columns?: string[],
): ReturnType<typeof Query.from> {
  return Query.from(tableName)
    .select(columns?.length ? columns.map((name) => column(name)) : ['*'])
    .limit(1);
}

function createDataTableExplorerArrowType(sqlType: string): arrow.DataType {
  const category = getDuckDbTypeCategory(sqlType);
  const type = sqlType.toLowerCase();

  switch (category) {
    case 'boolean':
      return new arrow.Bool();
    case 'datetime':
      return /^date$/.test(type)
        ? new arrow.DateDay()
        : new arrow.TimestampMillisecond();
    case 'number':
      if (
        /^(tinyint|smallint|integer|bigint|hugeint|utinyint|usmallint|uinteger|ubigint|uhugeint)/.test(
          type,
        )
      ) {
        return new arrow.Int64();
      }
      if (/^(decimal|numeric)/.test(type)) {
        return new arrow.Decimal(38, 9);
      }
      return new arrow.Float64();
    case 'binary':
      return new arrow.Binary();
    case 'geometry':
      return {
        toString() {
          return sqlType;
        },
      } as arrow.DataType;
    default:
      return new arrow.Utf8();
  }
}

export function fieldInfoToDataTableExplorerField(
  info: FieldInfo,
): arrow.Field {
  return new arrow.Field(
    info.column,
    createDataTableExplorerArrowType(info.sqlType),
    info.nullable,
  );
}

/**
 * Builds the base dataTableExplorer query before pagination is applied.
 *
 * @param args.columns Optional selected column names; when omitted, all columns
 * are selected.
 * @param args.filter Optional Mosaic where clause or clause array.
 * @param args.sorting Optional sort descriptors applied in order.
 * @param args.tableName Table reference to query. This accepts
 * DataTableExplorerSqlTableReference so callers can pass TableRefNode values
 * that preserve qualified identifier boundaries.
 * @returns Mosaic query with projection, filtering, and sorting applied.
 */
export function buildDataTableExplorerBaseQuery(args: {
  columns?: string[];
  filter?: QueryWhereInput;
  sorting?: DataTableExplorerSorting;
  tableName: DataTableExplorerSqlTableReference;
}) {
  const {columns, filter, sorting, tableName} = args;
  const query = Query.from(tableName)
    .select(columns?.length ? columns.map((name) => column(name)) : ['*'])
    .where(filter ?? []);

  if (sorting?.length) {
    query.orderby(
      sorting.map((entry) => (entry.desc ? desc(entry.id) : asc(entry.id))),
    );
  }

  return query;
}

/**
 * Applies normalized dataTableExplorer pagination to a base query.
 *
 * @param baseQuery Query returned by buildDataTableExplorerBaseQuery.
 * @param pagination Requested page index and page size.
 * @returns A cloned Mosaic query with limit and offset applied.
 */
export function buildDataTableExplorerPageQuery(
  baseQuery: ReturnType<typeof buildDataTableExplorerBaseQuery>,
  pagination: DataTableExplorerPaginationState,
) {
  const {pageIndex, pageSize} =
    normalizeDataTableExplorerPagination(pagination);

  return baseQuery
    .clone()
    .limit(pageSize)
    .offset(pageIndex * pageSize);
}

export function normalizeDataTableExplorerPagination(
  pagination: Partial<DataTableExplorerPaginationState> | undefined,
): DataTableExplorerPaginationState {
  const pageSize = Math.min(
    1000,
    Math.max(1, Math.trunc(Number(pagination?.pageSize) || 0) || 100),
  );
  const pageIndex = Math.max(0, Math.trunc(Number(pagination?.pageIndex) || 0));

  return {pageIndex, pageSize};
}

/**
 * Builds a row-count query for a dataTableExplorer table.
 *
 * @param args.filter Optional Mosaic where clause or clause array.
 * @param args.tableName Table reference to query. Pass a TableRefNode for
 * qualified references that should not be reparsed from a string.
 * @returns Mosaic query that returns a single count column.
 */
export function buildCountQuery(args: {
  filter?: QueryWhereInput;
  tableName: DataTableExplorerSqlTableReference;
}) {
  return Query.from(args.tableName)
    .select({count: count()})
    .where(args.filter ?? []);
}

/**
 * Builds a distinct-value count query for one dataTableExplorer field.
 *
 * @param args.filter Optional Mosaic where clause or clause array.
 * @param args.fieldName Field whose distinct non-null values should be counted.
 * @param args.tableName Table reference to query. Pass a TableRefNode for
 * qualified references that should not be reparsed from a string.
 * @returns Mosaic query that returns a single distinct count column.
 */
export function buildDistinctCountQuery(args: {
  filter?: QueryWhereInput;
  fieldName: string;
  tableName: DataTableExplorerSqlTableReference;
}) {
  return Query.from(args.tableName)
    .select({
      count: count(column(args.fieldName)).distinct(),
    })
    .where(args.filter ?? []);
}

export function readCountData(data: unknown): number | undefined {
  if (!data || typeof data !== 'object') {
    return undefined;
  }

  if ('toArray' in data && typeof data.toArray === 'function') {
    return (data.toArray() as Array<{count?: number}>)[0]?.count;
  }

  if ('get' in data && typeof data.get === 'function') {
    return (data.get(0) as {count?: number} | undefined)?.count;
  }

  return undefined;
}

export function rowsFromQueryResult<T>(data: unknown): T[] {
  if (
    !data ||
    typeof data !== 'object' ||
    !('toArray' in data) ||
    typeof (data as {toArray?: unknown}).toArray !== 'function'
  ) {
    return [];
  }

  return Array.from((data as {toArray(): T[]}).toArray());
}

/**
 * Builds the category summary query used by dataTableExplorer categorical
 * columns.
 *
 * @param tableName Table reference to query. This accepts
 * DataTableExplorerSqlTableReference so callers can use TableRefNode when
 * identifier boundaries must be preserved.
 * @param fieldName Field to summarize into value, null, unique, and overflow
 * buckets.
 * @param filter Optional Mosaic where clause or clause array.
 * @returns Mosaic query that produces bucket kind, typed value, and total count
 * rows for category summaries.
 */
export function buildCategorySummaryQuery(
  tableName: DataTableExplorerSqlTableReference,
  fieldName: string,
  filter?: QueryWhereInput,
) {
  const col = column(fieldName);
  const counts = Query.from({source: tableName})
    .select({
      bucket_kind: sql`CASE
        WHEN ${col} IS NULL THEN 'null'
        ELSE 'value'
      END`,
      typed_value: col,
      count: count(),
    })
    .groupby([
      sql`CASE
        WHEN ${col} IS NULL THEN 'null'
        ELSE 'value'
      END`,
      col,
    ])
    .where(filter ?? []);

  return Query.with({counts})
    .select({
      bucketKind: sql`CASE
        WHEN "count" = 1 AND "bucket_kind" = 'value' THEN 'unique'
        ELSE "bucket_kind"
      END`,
      typedValue: sql`CASE
        WHEN "count" = 1 AND "bucket_kind" = 'value' THEN NULL
        ELSE "typed_value"
      END`,
      total: sum('count'),
    })
    .from('counts')
    .groupby([
      sql`CASE
        WHEN "count" = 1 AND "bucket_kind" = 'value' THEN 'unique'
        ELSE "bucket_kind"
      END`,
      sql`CASE
        WHEN "count" = 1 AND "bucket_kind" = 'value' THEN NULL
        ELSE "typed_value"
      END`,
    ]);
}

export function splitHistogramBins(
  rows: Array<{
    x1: DataTableExplorerBin['x0'] | null;
    x2: DataTableExplorerBin['x1'] | null;
    y: number;
  }>,
) {
  let nullCount = 0;
  const bins: DataTableExplorerBin[] = [];

  for (const row of rows) {
    if (row.x1 == null || row.x2 == null) {
      nullCount += row.y;
      continue;
    }

    bins.push({
      x0: row.x1,
      x1: row.x2,
      length: row.y,
    });
  }

  bins.sort((left, right) => {
    const leftValue = left.x0 instanceof Date ? left.x0.getTime() : left.x0;
    const rightValue = right.x0 instanceof Date ? right.x0.getTime() : right.x0;
    return leftValue - rightValue;
  });

  return {bins, nullCount};
}

export function buildCategoryBuckets(
  filteredRows: CategoryCountRow[],
  totalRows: CategoryCountRow[],
  categoryLimit: number,
  selectedKey?: string,
) {
  const totalByKey = new Map(
    totalRows.map((row) => [serializeCategoryBucketKey(row), row.total]),
  );
  const filteredByKey = new Map(
    filteredRows.map((row) => [serializeCategoryBucketKey(row), row.total]),
  );

  const baseRows = totalRows
    .filter((row) => row.bucketKind === 'value')
    .slice()
    .sort(
      (left: CategoryCountRow, right: CategoryCountRow) =>
        right.total - left.total,
    );

  const visibleRows = baseRows.slice(0, categoryLimit);
  const overflowRows = baseRows.slice(categoryLimit);
  const buckets: DataTableExplorerCategoryBucket[] = visibleRows.map((row) => ({
    filteredCount: filteredByKey.get(serializeCategoryBucketKey(row)) ?? 0,
    key: serializeCategoryBucketKey(row),
    kind: 'value',
    label: String(row.typedValue),
    selectable: true,
    totalCount: row.total,
  }));

  const overflowTotalCount = overflowRows.reduce(
    (acc: number, row: CategoryCountRow) => acc + row.total,
    0,
  );
  const overflowFilteredCount = overflowRows.reduce(
    (acc: number, row: CategoryCountRow) =>
      acc + (filteredByKey.get(serializeCategoryBucketKey(row)) ?? 0),
    0,
  );
  if (overflowTotalCount > 0) {
    buckets.push({
      filteredCount: overflowFilteredCount,
      key: serializeCategoryBucketKey({
        bucketKind: 'unique',
        typedValue: '__sqlrooms_overflow__',
      }),
      kind: 'overflow',
      label: `${overflowRows.length} more`,
      selectable: false,
      totalCount: overflowTotalCount,
    });
  }

  const uniqueKey = serializeCategoryBucketKey({
    bucketKind: 'unique',
    typedValue: null,
  });
  const uniqueTotalCount = totalByKey.get(uniqueKey) ?? 0;
  if (uniqueTotalCount > 0) {
    buckets.push({
      filteredCount: filteredByKey.get(uniqueKey) ?? 0,
      key: uniqueKey,
      kind: 'unique',
      label: 'unique',
      selectable: false,
      totalCount: uniqueTotalCount,
    });
  }

  const nullKey = serializeCategoryBucketKey({
    bucketKind: 'null',
    typedValue: null,
  });
  const nullTotalCount = totalByKey.get(nullKey) ?? 0;
  if (nullTotalCount > 0) {
    buckets.push({
      filteredCount: filteredByKey.get(nullKey) ?? 0,
      key: nullKey,
      kind: 'null',
      label: 'null',
      selectable: true,
      totalCount: nullTotalCount,
    });
  }

  return {
    bucketCount: filteredRows.length,
    buckets,
    selectedKey,
  };
}

export function isSelectableCategoryKey(key: string) {
  const parsedKey = parseCategoryBucketKey(key);
  return (
    parsedKey?.bucketKind !== 'unique' &&
    parsedKey?.typedValue !== '__sqlrooms_overflow__'
  );
}

export function categoryKeyToSelectionValue(key?: string) {
  if (key === undefined) return undefined;
  const parsedKey = parseCategoryBucketKey(key);
  if (!parsedKey || parsedKey.bucketKind === 'unique') {
    return undefined;
  }
  return parsedKey.bucketKind === 'null' ? null : parsedKey.typedValue;
}

function normalizeCategoryBucketValue(value: unknown): unknown {
  if (value instanceof Date) {
    return {
      type: 'date',
      value: value.toISOString(),
    };
  }
  if (typeof value === 'bigint') {
    return {
      type: 'bigint',
      value: value.toString(),
    };
  }
  return value;
}

function denormalizeCategoryBucketValue(value: unknown): unknown {
  if (!value || typeof value !== 'object') {
    return value;
  }

  if (
    'type' in value &&
    'value' in value &&
    value.type === 'date' &&
    typeof value.value === 'string'
  ) {
    return new Date(value.value);
  }

  if (
    'type' in value &&
    'value' in value &&
    value.type === 'bigint' &&
    typeof value.value === 'string'
  ) {
    return BigInt(value.value);
  }

  return value;
}

export function serializeCategoryBucketKey(row: {
  bucketKind: CategoryCountRow['bucketKind'];
  typedValue: unknown;
}) {
  return JSON.stringify([
    row.bucketKind,
    normalizeCategoryBucketValue(row.typedValue),
  ]);
}

export function parseCategoryBucketKey(key: string):
  | {
      bucketKind: CategoryCountRow['bucketKind'];
      typedValue: unknown;
    }
  | undefined {
  try {
    const parsed = JSON.parse(key) as [CategoryCountRow['bucketKind'], unknown];
    if (!Array.isArray(parsed) || parsed.length !== 2) {
      return undefined;
    }

    return {
      bucketKind: parsed[0],
      typedValue: denormalizeCategoryBucketValue(parsed[1]),
    };
  } catch {
    return undefined;
  }
}

export function createEmptySummaryState(
  field: arrow.Field,
  kind: DataTableExplorerColumnKind = resolveDataTableExplorerColumnKind(field),
): DataTableExplorerSummaryState {
  if (kind === 'none') {
    return {
      isLoading: false,
      kind: 'none',
    };
  }

  if (kind === 'unsupported') {
    return {
      isLoading: false,
      kind: 'unsupported',
      label: 'No summary',
    };
  }

  return kind === 'histogram'
    ? {
        filteredBins: [],
        filteredNullCount: 0,
        interactor: null,
        isLoading: true,
        kind: 'histogram',
        totalBins: [],
        totalNullCount: 0,
        valueType:
          getDataTableExplorerValueType(field.type) === 'date'
            ? 'date'
            : 'number',
      }
    : {
        bucketCount: 0,
        buckets: [],
        isLoading: true,
        kind: 'category',
        toggleValue: () => {},
      };
}
