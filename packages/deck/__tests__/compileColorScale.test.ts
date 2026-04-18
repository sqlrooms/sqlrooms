import {
  Field,
  FixedSizeList,
  Float64,
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

  return new Table(schema, {
    geom: vectorFromArray([], pointField.type),
    magnitude: vectorFromArray([], new Float64()),
  });
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
        scheme: 'Tableau10',
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

    expect(legend.type).toBe('continuous');
    expect(legend.title).toBe('Magnitude');
    if (legend.type === 'continuous') {
      expect(legend.gradient).toContain('linear-gradient');
      expect(legend.ticks).toHaveLength(3);
    }
  });

  it('builds categorical legends with distinct items', () => {
    const table = createScaleTable();
    const legend = buildColorScaleLegend({
      table,
      colorScale: {
        field: 'status',
        type: 'categorical',
        scheme: 'Tableau10',
      },
      title: 'Status',
    });

    expect(legend.type).toBe('categorical');
    if (legend.type === 'categorical') {
      expect(legend.items).toHaveLength(2);
      expect(legend.items[0]?.color).toHaveLength(4);
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
});
