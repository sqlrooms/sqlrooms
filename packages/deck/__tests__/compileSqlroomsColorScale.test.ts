import {
  Field,
  FixedSizeList,
  Float64,
  Schema,
  Table,
  Utf8,
  vectorFromArray,
} from 'apache-arrow';
import {compileSqlroomsColorScale} from '../src/json/compileSqlroomsColorScale';

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

describe('compileSqlroomsColorScale', () => {
  it('maps sequential auto domains to rgba arrays', () => {
    const table = createScaleTable();
    const accessor = compileSqlroomsColorScale({
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
    const accessor = compileSqlroomsColorScale({
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
    const accessor = compileSqlroomsColorScale({
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
});
