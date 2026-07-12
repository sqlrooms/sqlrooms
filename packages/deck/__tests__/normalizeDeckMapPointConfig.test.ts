import type {DataTable} from '@sqlrooms/duckdb';
import {
  createDeckMapPointTransformSql,
  normalizeDeckMapPointConfig,
} from '../src/mapConfigUtils';
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
