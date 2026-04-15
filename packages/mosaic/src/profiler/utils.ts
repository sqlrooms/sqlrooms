import type {FieldInfo} from '@uwdata/mosaic-core';
import {asc, column, count, desc, Query, sql, sum} from '@uwdata/mosaic-sql';
import * as arrow from 'apache-arrow';
import type {
  MosaicProfilerBin,
  MosaicProfilerCategoryBucket,
  MosaicProfilerPaginationState,
  MosaicProfilerSorting,
  MosaicProfilerSummaryState,
} from './types';

export type CategoryCountRow = {
  bucketKind: 'null' | 'unique' | 'value';
  total: number;
  typedValue: unknown;
};

type QueryWhereInput = Parameters<ReturnType<typeof Query.from>['where']>[0];

export function isProfilerHistogramType(type: arrow.DataType): boolean {
  return (
    arrow.DataType.isDate(type) ||
    arrow.DataType.isTimestamp(type) ||
    arrow.DataType.isDecimal(type) ||
    arrow.DataType.isFloat(type) ||
    arrow.DataType.isInt(type)
  );
}

export function isProfilerUnsupportedSummaryType(
  type: arrow.DataType,
): boolean {
  return (
    arrow.DataType.isBinary(type) ||
    type.toString().toLowerCase().includes('geometry')
  );
}

export function getProfilerValueType(
  type: arrow.DataType,
): 'date' | 'number' | 'string' {
  if (arrow.DataType.isDate(type) || arrow.DataType.isTimestamp(type)) {
    return 'date';
  }
  if (
    arrow.DataType.isDecimal(type) ||
    arrow.DataType.isFloat(type) ||
    arrow.DataType.isInt(type)
  ) {
    return 'number';
  }
  return 'string';
}

export function buildSchemaQuery(
  tableName: string,
  columns?: string[],
): ReturnType<typeof Query.from> {
  return Query.from(tableName)
    .select(columns?.length ? columns.map((name) => column(name)) : ['*'])
    .limit(1);
}

function createProfilerArrowType(sqlType: string): arrow.DataType {
  const type = sqlType.toLowerCase();

  if (/^bool(ean)?/.test(type)) {
    return new arrow.Bool();
  }

  if (/^date$/.test(type)) {
    return new arrow.DateDay();
  }

  if (/^time$|^timestamp|^timestamptz/.test(type)) {
    return new arrow.TimestampMillisecond();
  }

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

  if (/^(double|float|real)/.test(type)) {
    return new arrow.Float64();
  }

  if (/^(blob|bytea|binary|varbinary)/.test(type)) {
    return new arrow.Binary();
  }

  if (/^geometry/.test(type)) {
    return {
      toString() {
        return sqlType;
      },
    } as arrow.DataType;
  }

  return new arrow.Utf8();
}

export function fieldInfoToProfilerField(info: FieldInfo): arrow.Field {
  return new arrow.Field(
    info.column,
    createProfilerArrowType(info.sqlType),
    info.nullable,
  );
}

export function buildProfilerBaseQuery(args: {
  columns?: string[];
  filter?: QueryWhereInput;
  sorting?: MosaicProfilerSorting;
  tableName: string;
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

export function buildProfilerPageQuery(
  baseQuery: ReturnType<typeof buildProfilerBaseQuery>,
  pagination: MosaicProfilerPaginationState,
) {
  const {pageIndex, pageSize} = normalizeProfilerPagination(pagination);

  return baseQuery
    .clone()
    .limit(pageSize)
    .offset(pageIndex * pageSize);
}

export function normalizeProfilerPagination(
  pagination: Partial<MosaicProfilerPaginationState> | undefined,
): MosaicProfilerPaginationState {
  const pageSize = Math.min(
    1000,
    Math.max(1, Math.trunc(Number(pagination?.pageSize) || 0) || 100),
  );
  const pageIndex = Math.max(0, Math.trunc(Number(pagination?.pageIndex) || 0));

  return {pageIndex, pageSize};
}

export function buildCountQuery(args: {
  filter?: QueryWhereInput;
  tableName: string;
}) {
  return Query.from(args.tableName)
    .select({count: count()})
    .where(args.filter ?? []);
}

export function buildDistinctCountQuery(args: {
  filter?: QueryWhereInput;
  fieldName: string;
  tableName: string;
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

export function buildCategorySummaryQuery(
  tableName: string,
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
    x1: MosaicProfilerBin['x0'] | null;
    x2: MosaicProfilerBin['x1'] | null;
    y: number;
  }>,
) {
  let nullCount = 0;
  const bins: MosaicProfilerBin[] = [];

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
  const buckets: MosaicProfilerCategoryBucket[] = visibleRows.map((row) => ({
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
): MosaicProfilerSummaryState {
  if (isProfilerUnsupportedSummaryType(field.type)) {
    return {
      isLoading: false,
      kind: 'unsupported',
      label: 'No summary',
    };
  }

  return isProfilerHistogramType(field.type)
    ? {
        filteredBins: [],
        filteredNullCount: 0,
        interactor: null,
        isLoading: true,
        kind: 'histogram',
        totalBins: [],
        totalNullCount: 0,
        valueType:
          getProfilerValueType(field.type) === 'date' ? 'date' : 'number',
      }
    : {
        bucketCount: 0,
        buckets: [],
        isLoading: true,
        kind: 'category',
        toggleValue: () => {},
      };
}
