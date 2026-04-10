import {sql} from '@uwdata/mosaic-sql';
import {
  buildCategoryBuckets,
  buildDistinctCountQuery,
  buildProfilerBaseQuery,
  buildProfilerPageQuery,
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

  it('builds category buckets with overflow, unique, and null buckets', () => {
    const result = buildCategoryBuckets(
      [
        {key: 'Mx', total: 8},
        {key: 'Md', total: 4},
        {key: '__sqlrooms_unique__', total: 2},
        {key: '__sqlrooms_null__', total: 1},
        {key: 'Ml', total: 1},
      ],
      [
        {key: 'Mx', total: 10},
        {key: 'Md', total: 5},
        {key: 'Ml', total: 3},
        {key: '__sqlrooms_unique__', total: 2},
        {key: '__sqlrooms_null__', total: 1},
      ],
      2,
      'Mx',
    );

    expect(result.bucketCount).toBe(5);
    expect(result.buckets.map((bucket) => bucket.key)).toEqual([
      'Mx',
      'Md',
      '__sqlrooms_overflow__',
      '__sqlrooms_unique__',
      '__sqlrooms_null__',
    ]);
    expect(
      result.buckets.find((bucket) => bucket.key === '__sqlrooms_overflow__'),
    ).toMatchObject({
      filteredCount: 1,
      totalCount: 3,
    });
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
      {x1: 0, x2: 10, y: 4},
      {x1: 20, x2: 30, y: 1},
    ]);

    expect(result.bins.map((bin) => [bin.x0, bin.x1])).toEqual([
      [0, 10],
      [10, 20],
      [20, 30],
    ]);
  });
});
