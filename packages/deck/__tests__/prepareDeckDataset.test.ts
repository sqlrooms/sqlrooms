import {
  Field,
  FixedSizeList,
  Float64,
  Schema,
  Table,
  vectorFromArray,
} from 'apache-arrow';
import {prepareDeckDataset} from '../src/prepare/prepareDeckDataset';

function createNativeGeoArrowPointTable() {
  const pointField = new Field(
    'geom',
    new FixedSizeList(2, new Field('xy', new Float64())),
    true,
    new Map([['ARROW:extension:name', 'geoarrow.point']]),
  );
  const valueField = new Field('magnitude', new Float64());
  const schema = new Schema([pointField, valueField]);

  return new Table(schema, {
    geom: vectorFromArray(
      [
        [7.4386, 46.9511],
        [8.5417, 47.3769],
      ],
      pointField.type,
    ),
    magnitude: vectorFromArray([3.2, 4.4]),
  });
}

describe('prepareDeckDataset', () => {
  it('detects native GeoArrow geometry and exposes both layer and binary data', () => {
    const table = createNativeGeoArrowPointTable();
    const prepared = prepareDeckDataset({
      datasetId: 'cities',
      table,
    });

    const resolved = prepared.resolveGeometry();
    expect(resolved.columnName).toBe('geom');
    expect(resolved.encoding).toBe('geoarrow.point');
    expect(resolved.nativeGeoArrow).toBe(true);

    const geoArrowLayerData = prepared.getGeoArrowLayerData();
    expect(geoArrowLayerData.source).toBe('native');
    expect(geoArrowLayerData.table).toBe(table);
    expect(geoArrowLayerData.geometryColumn).toBe(table.getChild('geom'));
    expect(prepared.getGeoJsonBinaryData()).toBeTruthy();
  });

  it('promotes WKT points for GeoArrow point layers and caches the result', () => {
    const table = new Table({
      geom: vectorFromArray(['POINT (7.4386 46.9511)', 'POINT (8.5417 47.3769)']),
      magnitude: vectorFromArray([3.2, 4.4]),
    });

    const prepared = prepareDeckDataset({
      datasetId: 'earthquakes',
      table,
    });

    const promoted = prepared.getGeoArrowLayerData();
    expect(promoted.source).toBe('promoted');
    expect(promoted.encoding).toBe('geoarrow.point');
    expect(promoted.geometryColumn).toBe(promoted.table.getChild('geom'));
    expect(prepared.getGeoArrowLayerData()).toBe(promoted);
    expect(prepared.getGeoJsonBinaryData()).toBe(prepared.getGeoJsonBinaryData());
  });

  it('can promote an empty WKT table for point layers', () => {
    const table = new Table({
      geom: vectorFromArray<string>([]),
      magnitude: vectorFromArray<number>([]),
    });

    const prepared = prepareDeckDataset({
      datasetId: 'earthquakes',
      table,
    });

    const promoted = prepared.getGeoArrowLayerData();
    expect(promoted.source).toBe('promoted');
    expect(promoted.encoding).toBe('geoarrow.point');
    expect(promoted.table.numRows).toBe(0);
  });

  it('requires an explicit geometry choice when multiple geometry-like columns exist', () => {
    const table = new Table({
      geom: vectorFromArray(['POINT (7.4386 46.9511)']),
      geometry: vectorFromArray(['POINT (8.5417 47.3769)']),
      name: vectorFromArray(['airport']),
    });

    expect(() =>
      prepareDeckDataset({
        datasetId: 'airports',
        table,
      }).resolveGeometry(),
    ).toThrow('Could not detect a geometry column.');

    const prepared = prepareDeckDataset({
      datasetId: 'airports',
      table,
      geometryColumn: 'geometry',
    });

    expect(prepared.resolveGeometry().columnName).toBe('geometry');
  });
});
