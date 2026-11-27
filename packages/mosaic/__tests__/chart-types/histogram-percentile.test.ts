import {makeQualifiedTableName, type DataTable} from '@sqlrooms/duckdb';
import {Query} from '@uwdata/mosaic-sql';
import {histogramChartType} from '../../src/charts/chart-types/histogram/definition';
import {createHistogramPercentileQueries} from '../../src/charts/chart-types/histogram/percentile';
import {createHistogramSpec} from '../../src/charts/chart-types/histogram/spec';
import {HistogramToolInput} from '../../src/charts/chart-types/histogram/tool';
import {parseChartConfig} from '../../src/charts/useParseChartConfig';
import {ChartPanelConfig} from '../../src/dashboard/dashboard-types';

const field = 'duration.ms';
const dataTable: DataTable = {
  table: makeQualifiedTableName({
    database: 'memory',
    schema: 'main',
    table: 'requests.2026',
  }),
  tableName: 'requests.2026',
  schema: 'main',
  isView: false,
  columns: [{name: field, type: 'DOUBLE'}],
};

describe('Upper percentile histogram', () => {
  it('retains the cutoff in document, dashboard and assistant configurations', () => {
    const settings = {field, upperPercentile: 99.5};
    const config = {chartType: 'histogram', settings};
    expect(parseChartConfig(config)).toMatchObject({
      success: true,
      config: {settings},
    });
    expect(
      ChartPanelConfig.parse({id: 'histogram', type: 'vgplot', config}),
    ).toMatchObject({config: {settings}});
    expect(
      HistogramToolInput.parse({
        tableName: 'requests',
        reasoning: 'Focus on typical request durations',
        settings: {...settings, color: null},
      }).settings.upperPercentile,
    ).toBe(99.5);
  });

  it.each([0, -1, 101])('rejects %s as a percentile', (upperPercentile) => {
    expect(
      parseChartConfig({chartType: 'histogram', settings: {upperPercentile}})
        .success,
    ).toBe(false);
  });

  it.each([null, 100, undefined])(
    'keeps the full-range chart and brush for %s',
    (upperPercentile) => {
      const settings = {field, upperPercentile};
      const spec = createHistogramSpec({
        dataTable,
        settings,
        selectionName: 'dashboard',
      });
      expect(spec).toMatchObject({
        xLabel: field,
        plot: [
          {data: {from: '"main"."requests.2026"'}, x: {bin: field}},
          {data: {from: '"main"."requests.2026"', filterBy: '$brush'}},
          {select: 'intervalX', as: '$brush'},
        ],
      });
      expect(
        histogramChartType.getRenderer?.({chartType: 'histogram', settings}),
      ).toBeUndefined();
    },
  );

  it('uses the same precomputed cutoff in both marks and brushes the raw field', () => {
    const settings = {field, upperPercentile: 99};
    const spec = createHistogramSpec(
      {dataTable, settings, selectionName: 'dashboard'},
      '12.75',
    );
    const [total, selected, brush] = spec.plot;
    if (
      !('data' in total) ||
      !('data' in selected) ||
      !total.data ||
      !selected.data ||
      Array.isArray(total.data) ||
      Array.isArray(selected.data)
    ) {
      throw new Error('Expected both histogram marks to have a data source');
    }
    expect(total.data.from).toBe(selected.data.from);
    expect(total.data.from).toBeInstanceOf(Query);
    expect(String(total.data.from)).toContain(
      '"duration.ms" <= CAST(\'12.75\' AS DOUBLE)',
    );
    expect(selected.data.filterBy).toBe('$brush');
    expect(brush).toMatchObject({select: 'intervalX', as: '$brush'});
    expect(String('field' in brush && brush.field)).toBe('"duration.ms"');
    expect(spec).toMatchObject({xLabel: 'duration.ms (through P99)'});
  });

  it('computes a cutoff in SQL when creating a clipped spec directly', () => {
    const spec = createHistogramSpec({
      dataTable,
      settings: {field, upperPercentile: 99},
    });
    const [total] = spec.plot;
    if (!('data' in total) || !total.data || Array.isArray(total.data)) {
      throw new Error('Expected a histogram mark with a data source');
    }
    const sql = String(total.data.from);
    expect(sql).toContain('QUANTILE_CONT("duration.ms", 0.99)');
    expect(sql).toContain('ISFINITE("duration.ms")');
    expect(sql).toContain('FROM "main"."requests.2026"');
  });

  it.each([
    ['BIGINT', '9007199254740993'],
    ['UBIGINT', '9007199254740993'],
    ['HUGEINT', '9007199254740993'],
    ['UHUGEINT', '9007199254740993'],
    ['TIMESTAMP_NS', '2026-01-01 00:00:00.000000001'],
  ])('preserves the source type for %s cutoffs', (type, cutoffValue) => {
    const {cutoff, source} = createHistogramPercentileQueries(
      dataTable.table,
      {name: field, type},
      99,
    );
    expect(String(cutoff)).toContain('QUANTILE_DISC("duration.ms", 0.99)');
    expect(String(source(cutoffValue))).toContain(
      `CAST('${cutoffValue}' AS ${type})`,
    );
  });

  it.each(['DECIMAL(19,18)', 'DECIMAL(38, 18)'])(
    'preserves the low-order digits of a %s median',
    (type) => {
      const {cutoff, source} = createHistogramPercentileQueries(
        dataTable.table,
        {name: field, type},
        50,
      );
      expect(String(cutoff)).toContain('QUANTILE_DISC("duration.ms", 0.5)');
      expect(String(source())).toContain('QUANTILE_DISC("duration.ms", 0.5)');
      expect(String(source('1.000000000000000002'))).toContain(
        `CAST('1.000000000000000002' AS ${type})`,
      );
    },
  );

  it('keeps interpolated cutoffs for decimals stored in 64 bits', () => {
    const {cutoff} = createHistogramPercentileQueries(
      dataTable.table,
      {name: field, type: 'DECIMAL(18, 17)'},
      50,
    );
    expect(String(cutoff)).toContain('QUANTILE_CONT("duration.ms", 0.5)');
  });

  it.each(['FLOAT', 'REAL'])(
    'restores a %s cutoff in its native type',
    (type) => {
      const {cutoff, source} = createHistogramPercentileQueries(
        dataTable.table,
        {name: field, type},
        99,
      );
      expect(String(cutoff)).toContain('QUANTILE_CONT("duration.ms", 0.99)');
      expect(String(source('0.1'))).toContain(
        `"duration.ms" <= CAST('0.1' AS ${type})`,
      );
    },
  );
});
