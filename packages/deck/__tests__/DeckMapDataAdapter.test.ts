import {describe, expect, test} from '@jest/globals';
import {directDeckMapDataAdapter} from '../src/DeckMapSurface';

describe('directDeckMapDataAdapter', () => {
  test('resolves worksheet datasets without Mosaic selection state', () => {
    const map = {
      id: 'map-1',
      title: 'Places',
      selectedTable: 'main.current_places',
      config: {
        spec: {layers: []},
        datasets: {
          places: {
            source: {
              tableName: 'main.authored_places',
              transformSql: 'SELECT * FROM __sqlrooms_source',
            },
            geometryColumn: 'geom',
          },
        },
      },
    };
    const datasets = directDeckMapDataAdapter.resolveDatasets({
      mapId: 'map-1',
      map,
    });
    expect(datasets.places).toMatchObject({
      tableName: 'main.current_places',
      geometryColumn: 'geom',
    });
    expect('transformSql' in datasets.places!).toBe(true);
    expect((datasets.places as {transformSql: string}).transformSql).toContain(
      'SELECT * FROM __sqlrooms_source',
    );
    expect((datasets.places as {transformSql: string}).transformSql).toContain(
      'USING SAMPLE 100000 ROWS',
    );
    expect(
      directDeckMapDataAdapter.resolveFitDataset?.({
        mapId: 'map-1',
        map,
        datasetId: 'places',
      }),
    ).toEqual({
      tableName: 'main.current_places',
      transformSql: 'SELECT * FROM __sqlrooms_source',
      geometryColumn: 'geom',
    });
  });

  test('preserves authored tables for maps with multiple table datasets', () => {
    const datasets = directDeckMapDataAdapter.resolveDatasets({
      mapId: 'map-1',
      map: {
        id: 'map-1',
        title: 'Places and regions',
        selectedTable: 'main.places',
        config: {
          spec: {layers: []},
          datasets: {
            places: {source: {tableName: 'main.places'}},
            regions: {
              source: {
                tableName: 'main.regions',
                transformSql: 'SELECT * FROM __sqlrooms_source',
              },
            },
          },
        },
      },
    });

    expect(datasets.places).toMatchObject({tableName: 'main.places'});
    expect(datasets.regions).toMatchObject({tableName: 'main.regions'});
    expect((datasets.places as {transformSql: string}).transformSql).toContain(
      'USING SAMPLE 100000 ROWS',
    );
    expect((datasets.regions as {transformSql: string}).transformSql).toContain(
      'SELECT * FROM __sqlrooms_source',
    );
  });

  test('applies a custom row limit to direct SQL datasets', () => {
    const map = {
      id: 'map-1',
      title: 'Places',
      config: {
        spec: {layers: []},
        datasets: {places: {source: {sqlQuery: 'SELECT * FROM places;'}}},
        dataPolicy: {maxRows: 250},
      },
    };
    const datasets = directDeckMapDataAdapter.resolveDatasets({
      mapId: 'map-1',
      map,
    });

    expect((datasets.places as {sqlQuery: string}).sqlQuery).toBe(
      'SELECT * FROM (SELECT * FROM places) USING SAMPLE 250 ROWS',
    );
    expect(
      directDeckMapDataAdapter.resolveFitDataset?.({
        mapId: 'map-1',
        map,
        datasetId: 'places',
      }),
    ).toEqual({sqlQuery: 'SELECT * FROM places;'});
  });

  test('preserves direct dataset queries when the row policy is disabled', () => {
    const datasets = directDeckMapDataAdapter.resolveDatasets({
      mapId: 'map-1',
      map: {
        id: 'map-1',
        title: 'Places',
        config: {
          spec: {layers: []},
          datasets: {places: {source: {tableName: 'main.places'}}},
          dataPolicy: {disabled: true},
        },
      },
    });

    expect(datasets.places).toEqual({
      tableName: 'main.places',
      transformSql: undefined,
    });
  });
});
