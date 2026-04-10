import {Selection} from '@uwdata/mosaic-core';
import {ProfilerCategoryClient} from '../src/profiler/ProfilerCategoryClient';
import {ProfilerHistogramClient} from '../src/profiler/ProfilerHistogramClient';

describe('profiler summary clients', () => {
  it('updates category selections and resets local state', () => {
    const selection = Selection.crossfilter();
    let latest: any;
    const client = new ProfilerCategoryClient({
      categoryLimit: 5,
      field: {name: 'MagType', type: {toString: () => 'Utf8'}} as any,
      onStateChange: (summary) => {
        latest = summary;
      },
      selection,
      tableName: 'earthquakes',
    });

    client.queryResult({
      toArray: () => [
        {key: 'Mx', total: 12},
        {key: 'Md', total: 8},
        {key: '__sqlrooms_null__', total: 1},
      ],
    });

    client.toggleValue('Mx');
    expect(selection.active.value).toBe('Mx');
    expect(latest.selectedKey).toBe('Mx');

    selection.reset();
    expect(latest.selectedKey).toBeUndefined();
  });

  it('publishes histogram interval selections through the shared selection', () => {
    const selection = Selection.crossfilter();
    let latest: any;
    const client = new ProfilerHistogramClient({
      field: {name: 'Magnitude', type: {toString: () => 'Float64'}} as any,
      onStateChange: (summary) => {
        latest = summary;
      },
      selection,
      steps: 10,
      tableName: 'earthquakes',
      valueType: 'number',
    });

    (client as any).fieldInfo = {
      column: 'Magnitude',
      nullable: true,
      sqlType: 'DOUBLE',
      table: 'earthquakes',
      type: 'number',
    };

    client.queryResult({
      toArray: () => [
        {x1: 0, x2: 2, y: 3},
        {x1: 2, x2: 4, y: 7},
      ],
    });

    const interactor = latest.interactor;
    (interactor as any).g = {call: () => {}};
    (interactor as any).scale = {
      apply: (value: number) => value,
      domain: [0, 10],
      invert: (value: number) => value,
      range: [0, 10],
    };

    interactor.publish([1, 3]);
    expect(selection.active.value).toEqual([1, 3]);
  });

  it('keeps the previous filtered histogram bins while a new query is pending', () => {
    const selection = Selection.crossfilter();
    let latest: any;
    const client = new ProfilerHistogramClient({
      field: {name: 'Magnitude', type: {toString: () => 'Float64'}} as any,
      onStateChange: (summary) => {
        latest = summary;
      },
      selection,
      steps: 10,
      tableName: 'earthquakes',
      valueType: 'number',
    });

    (client as any).totalBins = [
      {x1: 0, x2: 2, y: 10},
      {x1: 2, x2: 4, y: 20},
    ];
    (client as any).totalNullCount = 0;

    client.queryResult({
      toArray: () => [
        {x1: 0, x2: 2, y: 3},
        {x1: 2, x2: 4, y: 7},
      ],
    });

    client.queryPending();
    expect(latest.isLoading).toBe(true);
    expect(latest.filteredBins.map((bin: any) => bin.length)).toEqual([3, 7]);
    expect(latest.totalBins.map((bin: any) => bin.length)).toEqual([10, 20]);
  });

  it('builds histogram SQL by grouping on bin expressions, not aliases', () => {
    const selection = Selection.crossfilter();
    const client = new ProfilerHistogramClient({
      field: {name: 'Gap', type: {toString: () => 'Float64'}} as any,
      onStateChange: () => {},
      selection,
      steps: 10,
      tableName: 'earthquakes',
      valueType: 'number',
    });

    (client as any).fieldInfo = {
      column: 'Gap',
      max: 10,
      min: 0,
      nullable: true,
      sqlType: 'DOUBLE',
      table: 'earthquakes',
      type: 'number',
    };

    const sql = client.query([]).toString();
    expect(sql).toContain('GROUP BY floor("Gap")');
    expect(sql).not.toContain('GROUP BY "x1", "x2"');
  });

  it('keeps the previous filtered category counts while a new query is pending', () => {
    const selection = Selection.crossfilter();
    let latest: any;
    const client = new ProfilerCategoryClient({
      categoryLimit: 5,
      field: {name: 'MagType', type: {toString: () => 'Utf8'}} as any,
      onStateChange: (summary) => {
        latest = summary;
      },
      selection,
      tableName: 'earthquakes',
    });

    (client as any).totalRows = [
      {key: 'Mx', total: 12},
      {key: 'Md', total: 8},
    ];

    client.queryResult({
      toArray: () => [
        {key: 'Mx', total: 4},
        {key: 'Md', total: 2},
      ],
    });

    client.queryPending();
    expect(latest.isLoading).toBe(true);
    expect(
      latest.buckets.map((bucket: any) => [
        bucket.key,
        bucket.filteredCount,
        bucket.totalCount,
      ]),
    ).toEqual([
      ['Mx', 4, 12],
      ['Md', 2, 8],
    ]);
  });
});
