import {
  Field,
  FixedSizeList,
  Float64,
  List,
  Schema,
  Table,
  Utf8,
  vectorFromArray,
} from 'apache-arrow';
import {createDeckJsonSpecFromDatasets} from '../src/createDeckJsonSpecFromDatasets';

function createPointTable() {
  const pointField = new Field(
    'geom',
    new FixedSizeList(2, new Field('xy', new Float64())),
    true,
    new Map([['ARROW:extension:name', 'geoarrow.point']]),
  );

  return new Table(new Schema([pointField]), {
    geom: vectorFromArray([[7.4, 46.9]], pointField.type),
  });
}

function createLineTable() {
  const pointType = new FixedSizeList(2, new Field('xy', new Float64()));
  const lineType = new List(new Field('point', pointType));
  const lineField = new Field(
    'geom',
    lineType,
    true,
    new Map([['ARROW:extension:name', 'geoarrow.linestring']]),
  );

  return new Table(new Schema([lineField]), {
    geom: vectorFromArray(
      [
        [
          [7.4, 46.9],
          [8.5, 47.3],
        ],
      ],
      lineType,
    ),
  });
}

function createPolygonTable() {
  const pointType = new FixedSizeList(2, new Field('xy', new Float64()));
  const lineType = new List(new Field('point', pointType));
  const polygonType = new List(new Field('ring', lineType));
  const polygonField = new Field(
    'geom',
    polygonType,
    true,
    new Map([['ARROW:extension:name', 'geoarrow.polygon']]),
  );

  return new Table(new Schema([polygonField]), {
    geom: vectorFromArray(
      [
        [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ],
        ],
      ],
      polygonType,
    ),
  });
}

describe('createDeckJsonSpecFromDatasets', () => {
  it('chooses specialized defaults for native point, line, and polygon data', () => {
    const spec = createDeckJsonSpecFromDatasets({
      datasets: {
        points: {arrowTable: createPointTable()},
        lines: {arrowTable: createLineTable()},
        polygons: {arrowTable: createPolygonTable()},
      },
    });

    expect(spec.layers?.map((layer) => layer['@@type'])).toEqual([
      'GeoArrowScatterplotLayer',
      'GeoArrowPathLayer',
      'GeoArrowPolygonLayer',
    ]);
  });

  it('falls back to GeoJsonLayer for non-native or unresolved inputs', () => {
    const table = new Table({
      geom: vectorFromArray(['POINT (7.4 46.9)']),
    });

    const spec = createDeckJsonSpecFromDatasets({
      datasets: {
        wkt: {arrowTable: table},
        pending: {arrowTable: undefined},
      },
    });

    expect(spec.layers?.map((layer) => layer['@@type'])).toEqual([
      'GeoJsonLayer',
      'GeoJsonLayer',
    ]);
  });

  it('uses semantic hints for special layers without inferring them automatically', () => {
    const table = new Table({
      h3: vectorFromArray(['8928308280fffff'], new Utf8()),
    });

    const spec = createDeckJsonSpecFromDatasets({
      datasets: {
        heat: {arrowTable: createPointTable()},
        trips: {sqlQuery: 'select * from trips'},
        arcs: {sqlQuery: 'select * from arcs'},
        hexes: {arrowTable: table},
      },
      hints: {
        heat: {prefer: 'heatmap'},
        trips: {type: 'GeoArrowTripsLayer', timestampColumn: 'timestamps'},
        arcs: {
          type: 'GeoArrowArcLayer',
          sourceGeometryColumn: 'source_geom',
          targetGeometryColumn: 'target_geom',
        },
        hexes: {type: 'GeoArrowH3HexagonLayer', hexagonColumn: 'h3'},
      },
    });

    expect(spec.layers?.map((layer) => layer['@@type'])).toEqual([
      'GeoArrowHeatmapLayer',
      'GeoArrowTripsLayer',
      'GeoArrowArcLayer',
      'GeoArrowH3HexagonLayer',
    ]);
    expect(spec.layers?.[3]?._sqlrooms?.hexagonColumn).toBe('h3');
  });
});
