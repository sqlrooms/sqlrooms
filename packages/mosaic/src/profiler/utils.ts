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
  key: string;
  total: number;
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

export function isProfilerUnsupportedSummaryType(type: arrow.DataType): boolean {
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
  return baseQuery
    .clone()
    .limit(pagination.pageSize)
    .offset(pagination.pageIndex * pagination.pageSize);
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

export function buildCategorySummaryQuery(
  tableName: string,
  fieldName: string,
  filter?: QueryWhereInput,
) {
  const col = column(fieldName);
  const counts = Query.from({source: tableName})
    .select({
      value: sql`CASE
        WHEN ${col} IS NULL THEN '__sqlrooms_null__'
        ELSE CAST(${col} AS VARCHAR)
      END`,
      count: count(),
    })
    .groupby(
      sql`CASE
      WHEN ${col} IS NULL THEN '__sqlrooms_null__'
      ELSE CAST(${col} AS VARCHAR)
    END`,
    )
    .where(filter ?? []);

  return Query.with({counts})
    .select({
      key: sql`CASE
        WHEN "count" = 1 AND "value" != '__sqlrooms_null__' THEN '__sqlrooms_unique__'
        ELSE "value"
      END`,
      total: sum('count'),
    })
    .from('counts')
    .groupby('key');
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
      nullCount = row.y;
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
    const rightValue =
      right.x0 instanceof Date ? right.x0.getTime() : right.x0;
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
  const totalByKey = new Map(totalRows.map((row) => [row.key, row.total]));
  const filteredByKey = new Map(
    filteredRows.map((row) => [row.key, row.total]),
  );

  const baseRows = totalRows
    .filter(
      (row) =>
        row.key !== '__sqlrooms_null__' && row.key !== '__sqlrooms_unique__',
    )
    .slice()
    .sort(
      (left: CategoryCountRow, right: CategoryCountRow) =>
        right.total - left.total,
    );

  const visibleRows = baseRows.slice(0, categoryLimit);
  const overflowRows = baseRows.slice(categoryLimit);
  const buckets: MosaicProfilerCategoryBucket[] = visibleRows.map((row) => ({
    filteredCount: filteredByKey.get(row.key) ?? 0,
    key: row.key,
    kind: 'value',
    label: row.key,
    selectable: true,
    totalCount: row.total,
  }));

  const overflowTotalCount = overflowRows.reduce(
    (acc: number, row: CategoryCountRow) => acc + row.total,
    0,
  );
  const overflowFilteredCount = overflowRows.reduce(
    (acc: number, row: CategoryCountRow) =>
      acc + (filteredByKey.get(row.key) ?? 0),
    0,
  );
  if (overflowTotalCount > 0) {
    buckets.push({
      filteredCount: overflowFilteredCount,
      key: '__sqlrooms_overflow__',
      kind: 'overflow',
      label: `${overflowRows.length} more`,
      selectable: false,
      totalCount: overflowTotalCount,
    });
  }

  const uniqueTotalCount = totalByKey.get('__sqlrooms_unique__') ?? 0;
  if (uniqueTotalCount > 0) {
    buckets.push({
      filteredCount: filteredByKey.get('__sqlrooms_unique__') ?? 0,
      key: '__sqlrooms_unique__',
      kind: 'unique',
      label: 'unique',
      selectable: false,
      totalCount: uniqueTotalCount,
    });
  }

  const nullTotalCount = totalByKey.get('__sqlrooms_null__') ?? 0;
  if (nullTotalCount > 0) {
    buckets.push({
      filteredCount: filteredByKey.get('__sqlrooms_null__') ?? 0,
      key: '__sqlrooms_null__',
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
  return key !== '__sqlrooms_overflow__' && key !== '__sqlrooms_unique__';
}

export function categoryKeyToSelectionValue(key?: string) {
  if (key === undefined) return undefined;
  return key === '__sqlrooms_null__' ? null : key;
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
