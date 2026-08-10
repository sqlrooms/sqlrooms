import {describe, expect, test} from '@jest/globals';
import {
  createDeckMapBoundsQuery,
  getDeckMapDatasetSource,
  resolveDeckMapFitToData,
} from '../src/mapFit';

describe('Deck map fit core', () => {
  test('resolves geometry metadata without host state', () => {
    expect(
      resolveDeckMapFitToData({
        spec: {layers: []},
        datasets: {
          earthquakes: {
            source: {tableName: 'earthquakes'},
            geometryColumn: 'geom',
          },
        },
        fitToData: {dataset: 'earthquakes'},
      }),
    ).toEqual({dataset: 'earthquakes', geometryColumn: 'geom'});
  });

  test('resolves arc source and target geometry columns for fit-to-bounds', () => {
    expect(
      resolveDeckMapFitToData({
        spec: {
          layers: [
            {
              '@@type': 'GeoArrowArcLayer',
              _sqlroomsBinding: {
                dataset: 'arcs',
                sourceGeometryColumn: 'source_geom',
                targetGeometryColumn: 'target_geom',
              },
            },
          ],
        },
        datasets: {
          arcs: {source: {tableName: 'arcs'}},
        },
        fitToData: {dataset: 'arcs'},
      }),
    ).toEqual({
      dataset: 'arcs',
      geometryColumns: ['source_geom', 'target_geom'],
    });
  });

  test('prefers arc geometryColumns over a single geometryColumn', () => {
    expect(
      resolveDeckMapFitToData({
        spec: {
          layers: [
            {
              '@@type': 'GeoArrowArcLayer',
              _sqlroomsBinding: {
                dataset: 'arcs',
                sourceGeometryColumn: 'source_geom',
                targetGeometryColumn: 'target_geom',
              },
            },
          ],
        },
        datasets: {
          arcs: {
            source: {tableName: 'arcs'},
            geometryColumn: 'source_geom',
          },
        },
        fitToData: {dataset: 'arcs', geometryColumn: 'source_geom'},
      }),
    ).toEqual({
      dataset: 'arcs',
      geometryColumn: 'source_geom',
      geometryColumns: ['source_geom', 'target_geom'],
    });
  });

  test('resolves H3 hexagonColumn from layer binding for fit-to-bounds', () => {
    expect(
      resolveDeckMapFitToData({
        spec: {
          layers: [
            {
              '@@type': 'GeoArrowH3HexagonLayer',
              _sqlroomsBinding: {
                dataset: 'h3_data',
                hexagonColumn: 'hex_id',
              },
              getHexagon: '@@=hex_id',
            },
          ],
        },
        datasets: {
          h3_data: {source: {tableName: 'h3_pentagon'}},
        },
        fitToData: {dataset: 'h3_data'},
      }),
    ).toEqual({dataset: 'h3_data', h3Column: 'hex_id'});
  });

  test('falls back to getHexagon @@= column when hexagonColumn is missing', () => {
    expect(
      resolveDeckMapFitToData({
        spec: {
          layers: [
            {
              '@@type': 'GeoArrowH3HexagonLayer',
              _sqlroomsBinding: {dataset: 'h3_data'},
              getHexagon: '@@=hex_id',
            },
          ],
        },
        datasets: {
          h3_data: {source: {tableName: 'h3_pentagon'}},
        },
        fitToData: {dataset: 'h3_data'},
      }),
    ).toEqual({dataset: 'h3_data', h3Column: 'hex_id'});
  });

  test('builds H3 bounds SQL without casting the hexagon column', () => {
    const query = createDeckMapBoundsQuery({
      source: {tableName: 'h3_pentagon'},
      fitToData: {
        dataset: 'h3_data',
        h3Column: 'hex_id',
      },
    });

    expect(query).toContain('h3_cell_to_lng("hex_id")');
    expect(query).toContain('h3_cell_to_lat("hex_id")');
    expect(query).not.toContain('CAST("hex_id" AS VARCHAR)');
  });

  test('builds bounds SQL from a host-resolved table dataset', () => {
    const source = getDeckMapDatasetSource({
      tableName: 'earthquakes',
      transformSql: 'SELECT * FROM __sqlrooms_source',
    });
    expect(source).not.toBeNull();
    const query = createDeckMapBoundsQuery({
      source: source!,
      fitToData: {
        dataset: 'earthquakes',
        longitudeColumn: 'longitude',
        latitudeColumn: 'latitude',
      },
    });
    expect(query).toContain('ST_Extent_Agg');
    expect(query).toContain('"longitude"');
    expect(query).toContain('"latitude"');
  });

  test('builds bounds SQL that unions arc source and target geometries', () => {
    const query = createDeckMapBoundsQuery({
      source: {
        tableName: 'arcs',
        transformSql:
          'SELECT *, ST_AsWKB(ST_Point(1, 2)) AS source_geom, ST_AsWKB(ST_Point(3, 4)) AS target_geom FROM __sqlrooms_source',
      },
      fitToData: {
        dataset: 'arcs',
        geometryColumns: ['source_geom', 'target_geom'],
      },
    });

    expect(query).toContain('UNION ALL');
    expect(query).toContain('"source_geom"');
    expect(query).toContain('"target_geom"');
    expect(query).toContain('ST_GeomFromWKB');
  });

  test('strips trailing semicolons from SQL dataset bounds queries', () => {
    const query = createDeckMapBoundsQuery({
      source: {sqlQuery: ' SELECT * FROM earthquakes; ;  '},
      fitToData: {
        dataset: 'earthquakes',
        longitudeColumn: 'longitude',
        latitudeColumn: 'latitude',
      },
    });

    expect(query).toContain(
      'FROM (SELECT * FROM earthquakes) AS "__sqlrooms_dashboard_map_source"',
    );
  });
});
