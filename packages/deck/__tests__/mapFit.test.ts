import {describe, expect, test} from '@jest/globals';
import {
  buildDeckMapJumpToOptions,
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

  test('honors explicit fitToData.geometryColumn over arc inference', () => {
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
    });
  });

  test('prefers arc geometryColumns over dataset.geometryColumn alone', () => {
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
        fitToData: {dataset: 'arcs'},
      }),
    ).toEqual({
      dataset: 'arcs',
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

  test('ignores hidden H3 layers when resolving fit columns', () => {
    expect(
      resolveDeckMapFitToData({
        spec: {
          layers: [
            {
              '@@type': 'GeoArrowH3HexagonLayer',
              visible: false,
              _sqlroomsBinding: {
                dataset: 'points',
                hexagonColumn: 'hex_id',
              },
            },
            {
              '@@type': 'GeoArrowScatterplotLayer',
              _sqlroomsBinding: {
                dataset: 'points',
                geometryColumn: 'geom',
              },
            },
          ],
        },
        datasets: {
          points: {
            source: {tableName: 'earthquakes'},
            geometryColumn: 'geom',
          },
        },
        interaction: {
          longitudeColumn: 'Longitude',
          latitudeColumn: 'Latitude',
        },
        fitToData: {dataset: 'points'},
      }),
    ).toEqual({
      dataset: 'points',
      geometryColumn: 'geom',
    });
  });

  test('prefers explicit geometryColumn over a visible H3 overlay', () => {
    expect(
      resolveDeckMapFitToData({
        spec: {
          layers: [
            {
              '@@type': 'GeoArrowH3HexagonLayer',
              _sqlroomsBinding: {
                dataset: 'points',
                hexagonColumn: 'hex_id',
              },
            },
            {
              '@@type': 'GeoArrowScatterplotLayer',
              _sqlroomsBinding: {
                dataset: 'points',
                geometryColumn: 'geom',
              },
            },
          ],
        },
        datasets: {
          points: {
            source: {tableName: 'earthquakes'},
            geometryColumn: 'geom',
          },
        },
        fitToData: {dataset: 'points', geometryColumn: 'geom'},
      }),
    ).toEqual({
      dataset: 'points',
      geometryColumn: 'geom',
    });
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

  test('builds bounds SQL that unnests arc source and target geometries in one pass', () => {
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

    expect(query).toContain('UNNEST([');
    expect(query).toContain('"source_geom"');
    expect(query).toContain('"target_geom"');
    expect(query).toContain('ST_GeomFromWKB');
    expect(query).not.toContain('UNION ALL');
    // Source subquery should appear once (not once per geometry column).
    expect(query.match(/__sqlrooms_dashboard_map_geom"/g)).toHaveLength(1);
  });

  test('decodes mixed WKB and native geometry columns independently for fit', () => {
    const query = createDeckMapBoundsQuery({
      source: {
        tableName: 'arcs',
        transformSql:
          'SELECT *, ST_AsWKB(ST_Point(1, 2)) AS source_geom, ST_Point(3, 4) AS target_geom FROM __sqlrooms_source',
      },
      fitToData: {
        dataset: 'arcs',
        geometryColumns: ['source_geom', 'target_geom'],
      },
    });

    expect(query).toContain('ST_GeomFromWKB("source_geom")');
    expect(query).toContain('"target_geom"::GEOMETRY');
    expect(query).not.toContain('ST_GeomFromWKB("target_geom")');
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

describe('buildDeckMapJumpToOptions', () => {
  test('omits pitch and bearing unless explicitly provided (preserve pitched view)', () => {
    expect(
      buildDeckMapJumpToOptions({
        longitude: 144.96,
        latitude: -37.81,
        zoom: 13,
      }),
    ).toEqual({
      center: [144.96, -37.81],
      zoom: 13,
    });
  });

  test('includes pitch and bearing when provided', () => {
    expect(
      buildDeckMapJumpToOptions({
        longitude: 144.96,
        latitude: -37.81,
        zoom: 13,
        pitch: 55,
        bearing: 20,
      }),
    ).toEqual({
      center: [144.96, -37.81],
      zoom: 13,
      pitch: 55,
      bearing: 20,
    });
  });
});
