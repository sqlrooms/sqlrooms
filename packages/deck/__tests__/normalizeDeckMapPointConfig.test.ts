import {makeQualifiedTableName, type DataTable} from '@sqlrooms/duckdb';
import {
  createDeckMapPointTransformSql,
  normalizeDeckMapPointConfig,
  regenerateMapConfigForTable,
} from '../src/mapConfigUtils';
import {createEmptyDeckMapConfig} from '../src/mapConfig';
import {DECK_TABLE_DATASET_SOURCE_RELATION} from '../src/datasets/tableDatasetSql';

const placesTable = {
  tableName: 'places',
  columns: [
    {name: 'longitude', type: 'DOUBLE'},
    {name: 'latitude', type: 'DOUBLE'},
    {name: 'name', type: 'VARCHAR'},
  ],
} as DataTable;

describe('normalizeDeckMapPointConfig', () => {
  it('exports the shared WKB point transform SQL', () => {
    expect(
      createDeckMapPointTransformSql({
        longitudeColumn: 'longitude',
        latitudeColumn: 'latitude',
        geometryColumn: '__sqlrooms_geom',
      }),
    ).toContain(DECK_TABLE_DATASET_SOURCE_RELATION);
  });

  it('injects transformSql and geometry bindings for lon/lat table sources', () => {
    const config = {
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            id: 'places',
            _sqlroomsBinding: {dataset: 'places'},
          },
        ],
      },
      datasets: {
        places: {
          source: {tableName: 'places'},
        },
      },
    };

    const next = normalizeDeckMapPointConfig({
      config,
      resolveTable: (tableName) =>
        tableName === 'places' ? placesTable : undefined,
    });

    expect(next.datasets.places).toMatchObject({
      geometryColumn: '__sqlrooms_geom',
      geometryEncodingHint: 'wkb',
      source: {
        tableName: 'places',
        transformSql: expect.stringContaining('ST_AsWKB'),
      },
    });
    expect(next.spec.layers[0]._sqlroomsBinding).toMatchObject({
      dataset: 'places',
      geometryColumn: '__sqlrooms_geom',
    });
    expect(next.fitToData).toMatchObject({
      dataset: 'places',
      geometryColumn: '__sqlrooms_geom',
    });
  });

  it('repairs a generated geometry alias that is missing from the table', () => {
    const config = {
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            id: 'places',
            _sqlroomsBinding: {
              dataset: 'places',
              geometryColumn: '__sqlrooms_geom',
            },
          },
        ],
      },
      datasets: {
        places: {
          source: {tableName: 'places'},
          geometryColumn: '__sqlrooms_geom',
        },
      },
      fitToData: {dataset: 'places', geometryColumn: '__sqlrooms_geom'},
    };

    const next = normalizeDeckMapPointConfig({
      config,
      resolveTable: () => placesTable,
    });

    expect(next.datasets.places).toMatchObject({
      geometryColumn: '__sqlrooms_geom',
      geometryEncodingHint: 'wkb',
      source: {
        tableName: 'places',
        transformSql: expect.stringContaining('ST_AsWKB'),
      },
    });
  });

  it('preserves a generated geometry alias that exists in the table', () => {
    const config = {
      spec: {layers: []},
      datasets: {
        places: {
          source: {tableName: 'places'},
          geometryColumn: '__sqlrooms_geom',
          geometryEncodingHint: 'wkb' as const,
        },
      },
    };

    expect(
      normalizeDeckMapPointConfig({
        config,
        resolveTable: () => ({
          ...placesTable,
          columns: [
            ...placesTable.columns,
            {name: '__sqlrooms_geom', type: 'BLOB'},
          ],
        }),
      }),
    ).toBe(config);
  });

  it('skips datasets that already have transformSql or sqlQuery', () => {
    const config = {
      spec: {layers: []},
      datasets: {
        places: {
          source: {
            tableName: 'places',
            transformSql: 'SELECT * FROM __sqlrooms_table_dataset_source',
          },
        },
      },
    };

    expect(
      normalizeDeckMapPointConfig({
        config,
        resolveTable: () => placesTable,
      }),
    ).toBe(config);
  });

  it('preserves datasets with an explicit geometry column', () => {
    const config = {
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowPolygonLayer',
            id: 'places',
            _sqlroomsBinding: {dataset: 'places', geometryColumn: 'geom'},
          },
        ],
      },
      datasets: {
        places: {
          source: {tableName: 'places'},
          geometryColumn: 'geom',
          geometryEncodingHint: 'wkb',
        },
      },
      fitToData: {dataset: 'places', geometryColumn: 'geom'},
    };

    expect(
      normalizeDeckMapPointConfig({
        config,
        resolveTable: () => ({
          ...placesTable,
          columns: [...placesTable.columns, {name: 'geom', type: 'BLOB'}],
        }),
      }),
    ).toBe(config);
  });

  it('preserves datasets when the table has an inferred geometry column', () => {
    const config = {
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowPolygonLayer',
            id: 'places',
            _sqlroomsBinding: {dataset: 'places'},
          },
        ],
      },
      datasets: {
        places: {
          source: {tableName: 'places'},
        },
      },
    };

    expect(
      normalizeDeckMapPointConfig({
        config,
        resolveTable: () => ({
          ...placesTable,
          columns: [...placesTable.columns, {name: 'geom', type: 'GEOMETRY'}],
        }),
      }),
    ).toBe(config);
  });
});

describe('regenerateMapConfigForTable', () => {
  it('infers the counterpart when the first coordinate is selected', () => {
    const config = createEmptyDeckMapConfig();
    const table = {
      ...placesTable,
      columns: [
        {name: 'longitude', type: 'DOUBLE'},
        {name: 'northing', type: 'DOUBLE'},
      ],
    } as DataTable;

    const next = regenerateMapConfigForTable(
      {config},
      table,
      undefined,
      'northing',
    );

    expect(next.fitToData).toMatchObject({
      longitudeColumn: 'longitude',
      latitudeColumn: 'northing',
    });
    expect(Object.values(next.datasets)[0]?.source).toMatchObject({
      transformSql: expect.stringContaining(
        'ST_Point("longitude", "northing")',
      ),
    });
  });

  it('seeds a generated layer when a table is selected for an empty map', () => {
    const config = createEmptyDeckMapConfig();
    const table: DataTable = {
      table: makeQualifiedTableName({schema: 'main', table: 'places'}),
      tableName: 'places',
      schema: 'main',
      isView: false,
      columns: [
        {name: 'longitude', type: 'DOUBLE'},
        {name: 'latitude', type: 'DOUBLE'},
      ],
    };

    const next = regenerateMapConfigForTable({config}, table);

    expect(Object.keys(next.datasets)).toEqual(['places']);
    expect(next.spec.layers).toHaveLength(1);
    expect(next.spec.layers[0]).toMatchObject({
      '@@type': 'GeoArrowScatterplotLayer',
      _sqlroomsBinding: {dataset: 'places'},
    });
  });

  it('seeds a generated layer when an empty map stores a string spec', () => {
    const config = {spec: JSON.stringify({layers: []}), datasets: {}};
    const table: DataTable = {
      table: makeQualifiedTableName({schema: 'main', table: 'places'}),
      tableName: 'places',
      schema: 'main',
      isView: false,
      columns: [
        {name: 'longitude', type: 'DOUBLE'},
        {name: 'latitude', type: 'DOUBLE'},
      ],
    };

    const next = regenerateMapConfigForTable({config}, table);

    expect(Object.keys(next.datasets)).toEqual(['places']);
    expect(next.spec).toMatchObject({
      layers: [
        expect.objectContaining({_sqlroomsBinding: {dataset: 'places'}}),
      ],
    });
  });

  it('returns the existing config for a non-geospatial table', () => {
    const config = {
      spec: {layers: []},
      datasets: {places: {source: {tableName: 'places'}}},
    };
    const table: DataTable = {
      table: makeQualifiedTableName({schema: 'main', table: 'people'}),
      tableName: 'people',
      schema: 'main',
      isView: false,
      columns: [{name: 'name', type: 'VARCHAR'}],
    };

    expect(regenerateMapConfigForTable({config}, table)).toBe(config);
  });

  it('returns the existing config when multiple datasets make the target ambiguous', () => {
    const config = {
      spec: {
        layers: [
          {_sqlroomsBinding: {dataset: 'places'}},
          {_sqlroomsBinding: {dataset: 'regions'}},
        ],
      },
      datasets: {
        places: {source: {tableName: 'places'}},
        regions: {source: {tableName: 'regions'}},
      },
    };
    const table: DataTable = {
      table: makeQualifiedTableName({schema: 'main', table: 'new_places'}),
      tableName: 'new_places',
      schema: 'main',
      isView: false,
      columns: [
        {name: 'longitude', type: 'DOUBLE'},
        {name: 'latitude', type: 'DOUBLE'},
      ],
    };

    expect(regenerateMapConfigForTable({config}, table)).toBe(config);
  });

  it('preserves a single dataset id used by retained layer bindings', () => {
    const config = {
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            id: 'places-layer',
            _sqlroomsBinding: {dataset: 'places'},
          },
        ],
      },
      datasets: {
        places: {
          source: {tableName: 'old_places'},
          geometryColumn: '__sqlrooms_geom',
        },
      },
      fitToData: {
        dataset: 'places',
        longitudeColumn: 'longitude',
        latitudeColumn: 'latitude',
      },
    };
    const nextTable: DataTable = {
      table: makeQualifiedTableName({schema: 'main', table: 'new_places'}),
      tableName: 'new_places',
      schema: 'main',
      isView: false,
      columns: [
        {name: 'longitude', type: 'DOUBLE'},
        {name: 'latitude', type: 'DOUBLE'},
      ],
    };

    const next = regenerateMapConfigForTable({config}, nextTable);

    expect(Object.keys(next.datasets)).toEqual(['places']);
    expect(next.datasets.places?.source).toMatchObject({
      tableName: '"main"."new_places"',
    });
    expect(next.fitToData?.dataset).toBe('places');
    expect(next.spec).toBe(config.spec);
  });

  it('refreshes retained geometry bindings for the selected table', () => {
    const config = {
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowPolygonLayer',
            _sqlroomsBinding: {dataset: 'places', geometryColumn: 'geom'},
          },
        ],
      },
      datasets: {
        places: {
          source: {tableName: 'old_places'},
          geometryColumn: 'geom',
        },
      },
      fitToData: {dataset: 'places', geometryColumn: 'geom'},
    };
    const nextTable: DataTable = {
      table: makeQualifiedTableName({schema: 'main', table: 'new_places'}),
      tableName: 'new_places',
      schema: 'main',
      isView: false,
      columns: [{name: 'geometry', type: 'GEOMETRY'}],
    };

    const next = regenerateMapConfigForTable({config}, nextTable);

    expect(next.datasets.places?.geometryColumn).toBe('geometry');
    expect(next.fitToData?.geometryColumn).toBe('geometry');
    expect(next.spec.layers[0]._sqlroomsBinding).toMatchObject({
      dataset: 'places',
      geometryColumn: 'geometry',
    });
  });
});
