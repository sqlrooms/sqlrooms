import {
  Field,
  FixedSizeList,
  Float64,
  makeVector,
  Schema,
  Table,
  Utf8,
  vectorFromArray,
} from 'apache-arrow';
import {
  buildColorScaleLegend,
  compileColorScale,
} from '../src/json/compileColorScale';

function createScaleTable() {
  const pointField = new Field(
    'geom',
    new FixedSizeList(2, new Field('xy', new Float64())),
    true,
    new Map([['ARROW:extension:name', 'geoarrow.point']]),
  );
  const magnitudeField = new Field('magnitude', new Float64());
  const statusField = new Field('status', new Utf8());
  const schema = new Schema([pointField, magnitudeField, statusField]);

  return new Table(schema, {
    geom: vectorFromArray(
      [
        [7.4386, 46.9511],
        [7.45, 46.96],
      ],
      pointField.type,
    ),
    magnitude: vectorFromArray([1.5, 6.5]),
    status: vectorFromArray(['low', 'high']),
  });
}

function createEmptyNumericScaleTable() {
  const pointField = new Field(
    'geom',
    new FixedSizeList(2, new Field('xy', new Float64())),
    true,
    new Map([['ARROW:extension:name', 'geoarrow.point']]),
  );
  const magnitudeField = new Field('magnitude', new Float64());
  const schema = new Schema([pointField, magnitudeField]);

  const geomVec = makeVector({
    type: pointField.type,
    length: 0,
    nullCount: 0,
    children: [{type: new Float64(), length: 0, nullCount: 0}],
  });
  const magVec = makeVector({type: new Float64(), length: 0, nullCount: 0});

  return new Table(schema, [geomVec, magVec]);
}

describe('compileColorScale', () => {
  it('maps sequential auto domains to rgba arrays', () => {
    const table = createScaleTable();
    const accessor = compileColorScale({
      table,
      colorScale: {
        field: 'magnitude',
        type: 'sequential',
        scheme: 'YlOrRd',
        domain: 'auto',
      },
    });

    expect(accessor({index: 0})).toHaveLength(4);
    expect(accessor({index: 0})).not.toEqual(accessor({index: 1}));
  });

  it('supports categorical schemes with raw row objects', () => {
    const table = createScaleTable();
    const accessor = compileColorScale({
      table,
      colorScale: {
        field: 'status',
        type: 'categorical',
        scheme: 'Category10',
      },
    });

    expect(accessor({status: 'low'})).toHaveLength(4);
    expect(accessor({status: 'low'})).not.toEqual(accessor({status: 'high'}));
  });

  it('uses nullColor for missing values', () => {
    const table = createScaleTable();
    const accessor = compileColorScale({
      table,
      colorScale: {
        field: 'magnitude',
        type: 'sequential',
        scheme: 'Blues',
        domain: [0, 10],
        nullColor: [9, 8, 7, 6],
      },
    });

    expect(accessor({magnitude: null})).toEqual([9, 8, 7, 6]);
  });

  it('returns nullColor for empty numeric datasets', () => {
    const table = createEmptyNumericScaleTable();
    const accessor = compileColorScale({
      table,
      colorScale: {
        field: 'magnitude',
        type: 'sequential',
        scheme: 'Blues',
        domain: 'auto',
        nullColor: [9, 8, 7, 6],
      },
    });

    expect(accessor({index: 0})).toEqual([9, 8, 7, 6]);
  });

  it('builds continuous legends for sequential scales', () => {
    const table = createScaleTable();
    const legend = buildColorScaleLegend({
      table,
      colorScale: {
        field: 'magnitude',
        type: 'sequential',
        scheme: 'YlOrRd',
        domain: 'auto',
      },
      title: 'Magnitude',
    });

    expect(legend).not.toBeNull();
    expect(legend!.type).toBe('continuous');
    expect(legend!.title).toBe('Magnitude');
    if (legend!.type === 'continuous') {
      expect(legend!.gradient).toContain('linear-gradient');
      expect(legend!.ticks).toHaveLength(3);
    }
  });

  it('builds categorical legends with distinct items', () => {
    const table = createScaleTable();
    const legend = buildColorScaleLegend({
      table,
      colorScale: {
        field: 'status',
        type: 'categorical',
        scheme: 'Observable10',
      },
      title: 'Status',
    });

    expect(legend).not.toBeNull();
    expect(legend!.type).toBe('categorical');
    if (legend!.type === 'categorical') {
      expect(legend!.items).toHaveLength(2);
      expect(legend!.items[0]?.color).toHaveLength(4);
    }
  });

  it('skips legends for empty numeric datasets', () => {
    const table = createEmptyNumericScaleTable();
    const legend = buildColorScaleLegend({
      table,
      colorScale: {
        field: 'magnitude',
        type: 'sequential',
        scheme: 'YlOrRd',
        domain: 'auto',
      },
      title: 'Magnitude',
    });

    expect(legend).toBeNull();
  });

  it('supports quantize scales with discrete numeric schemes', () => {
    const table = createScaleTable();
    const accessor = compileColorScale({
      table,
      colorScale: {
        field: 'magnitude',
        type: 'quantize',
        scheme: 'PuBuGn',
        domain: [0, 8],
        bins: 4,
      },
    });

    expect(accessor({index: 0})).toHaveLength(4);
    expect(accessor({index: 0})).not.toEqual(accessor({index: 1}));
  });

  it('supports quantile legends as stepped legends', () => {
    const table = createScaleTable();
    const legend = buildColorScaleLegend({
      table,
      colorScale: {
        field: 'magnitude',
        type: 'quantile',
        scheme: 'Blues',
        bins: 3,
      },
      title: 'Magnitude',
    });

    expect(legend?.type).toBe('stepped');
    if (legend?.type === 'stepped') {
      expect(legend.items).toHaveLength(3);
    }
  });

  it('supports threshold scales with diverging discrete schemes', () => {
    const table = createScaleTable();
    const accessor = compileColorScale({
      table,
      colorScale: {
        field: 'magnitude',
        type: 'threshold',
        scheme: 'RdYlBu',
        thresholds: [2, 4, 6],
      },
    });

    expect(accessor({index: 0})).toHaveLength(4);
    expect(accessor({index: 0})).not.toEqual(accessor({index: 1}));
  });
});
