import {sql} from '@uwdata/mosaic-sql';
import {
  buildCategoryBuckets,
  buildCategorySummaryQuery,
  buildDistinctCountQuery,
  buildProfilerBaseQuery,
  buildProfilerPageQuery,
  normalizeProfilerPagination,
  serializeCategoryBucketKey,
  rowsFromQueryResult,
  splitHistogramBins,
} from '../src/profiler/utils';

describe('profiler utils', () => {
  it('builds base SQL without pagination and page SQL with limit/offset', () => {
    const base = buildProfilerBaseQuery({
      columns: ['Magnitude', 'Depth'],
      filter: sql`"Magnitude" > 4`,
      sorting: [{desc: true, id: 'Magnitude'}],
      tableName: 'earthquakes',
    });

    expect(base.toString()).toContain('SELECT "Magnitude", "Depth"');
    expect(base.toString()).toContain('WHERE "Magnitude" > 4');
    expect(base.toString()).toContain('ORDER BY "Magnitude" DESC');
    expect(base.toString()).not.toContain('LIMIT');

    const page = buildProfilerPageQuery(base, {pageIndex: 2, pageSize: 25});
    expect(page.toString()).toContain('LIMIT 25');
    expect(page.toString()).toContain('OFFSET 50');
  });

  it('sanitizes invalid pagination values before generating LIMIT/OFFSET', () => {
    const base = buildProfilerBaseQuery({
      columns: ['Magnitude'],
      tableName: 'earthquakes',
    });

    const page = buildProfilerPageQuery(base, {
      pageIndex: -4,
      pageSize: Number.NaN as unknown as number,
    });
    expect(page.toString()).toContain('LIMIT 100');
    expect(page.toString()).toContain('OFFSET 0');
  });

  it('normalizes pagination values for store/query consumers', () => {
    expect(
      normalizeProfilerPagination({
        pageIndex: -3,
        pageSize: Number.NaN,
      }),
    ).toEqual({
      pageIndex: 0,
      pageSize: 100,
    });
    expect(
      normalizeProfilerPagination({
        pageIndex: 2.9,
        pageSize: 5000,
      }),
    ).toEqual({
      pageIndex: 2,
      pageSize: 1000,
    });
  });

  it('builds category buckets with overflow, unique, and null buckets', () => {
    const result = buildCategoryBuckets(
      [
        {bucketKind: 'value', total: 8, typedValue: 'Mx'},
        {bucketKind: 'value', total: 4, typedValue: 'Md'},
        {bucketKind: 'unique', total: 2, typedValue: null},
        {bucketKind: 'null', total: 1, typedValue: null},
        {bucketKind: 'value', total: 1, typedValue: 'Ml'},
      ],
      [
        {bucketKind: 'value', total: 10, typedValue: 'Mx'},
        {bucketKind: 'value', total: 5, typedValue: 'Md'},
        {bucketKind: 'value', total: 3, typedValue: 'Ml'},
        {bucketKind: 'unique', total: 2, typedValue: null},
        {bucketKind: 'null', total: 1, typedValue: null},
      ],
      2,
      serializeCategoryBucketKey({bucketKind: 'value', typedValue: 'Mx'}),
    );

    expect(result.bucketCount).toBe(5);
    expect(result.buckets.map((bucket) => bucket.key)).toEqual([
      serializeCategoryBucketKey({bucketKind: 'value', typedValue: 'Mx'}),
      serializeCategoryBucketKey({bucketKind: 'value', typedValue: 'Md'}),
      serializeCategoryBucketKey({
        bucketKind: 'unique',
        typedValue: '__sqlrooms_overflow__',
      }),
      serializeCategoryBucketKey({bucketKind: 'unique', typedValue: null}),
      serializeCategoryBucketKey({bucketKind: 'null', typedValue: null}),
    ]);
    expect(
      result.buckets.find((bucket) => bucket.kind === 'overflow'),
    ).toMatchObject({
      filteredCount: 1,
      totalCount: 3,
    });
  });

  it('builds category summary SQL without sentinel key strings', () => {
    const query = buildCategorySummaryQuery('earthquakes', 'MagType');
    const sqlText = query.toString();

    expect(sqlText).toContain(`'null'`);
    expect(sqlText).toContain(`'unique'`);
    expect(sqlText).not.toContain('__sqlrooms_null__');
    expect(sqlText).not.toContain('__sqlrooms_unique__');
  });

  it('builds a distinct-count query for unsupported summary columns', () => {
    const query = buildDistinctCountQuery({
      fieldName: 'geom',
      tableName: 'earthquakes',
    });

    expect(query.toString()).toContain('count(DISTINCT "geom")');
  });

  it('applies filters to distinct-count queries', () => {
    const query = buildDistinctCountQuery({
      fieldName: 'geom',
      filter: sql`"Magnitude" > 4`,
      tableName: 'earthquakes',
    });

    expect(query.toString()).toContain('WHERE "Magnitude" > 4');
  });

  it('sorts histogram bins by ascending lower bound before returning them', () => {
    const result = splitHistogramBins([
      {x1: 10, x2: 20, y: 2},
      {x1: null, x2: null, y: 3},
      {x1: 0, x2: 10, y: 4},
      {x1: null, x2: null, y: 2},
      {x1: 20, x2: 30, y: 1},
    ]);

    expect(result.bins.map((bin) => [bin.x0, bin.x1])).toEqual([
      [0, 10],
      [10, 20],
      [20, 30],
    ]);
    expect(result.nullCount).toBe(5);
  });

  it('returns rows only when toArray is callable', () => {
    expect(rowsFromQueryResult<{value: number}>({toArray: 'nope'})).toEqual([]);
    expect(
      rowsFromQueryResult<{value: number}>({
        toArray: () => [{value: 1}, {value: 2}],
      }),
    ).toEqual([{value: 1}, {value: 2}]);
  });
});
