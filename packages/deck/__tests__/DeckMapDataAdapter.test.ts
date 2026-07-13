import {describe, expect, test} from '@jest/globals';
import {directDeckMapDataAdapter} from '../src/DeckMapSurface';

describe('directDeckMapDataAdapter', () => {
  test('resolves worksheet datasets without Mosaic selection state', () => {
    const datasets = directDeckMapDataAdapter.resolveDatasets({
      mapId: 'map-1',
      map: {
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
      },
    });
    expect(datasets).toEqual({
      places: {
        tableName: 'main.current_places',
        transformSql: 'SELECT * FROM __sqlrooms_source',
        geometryColumn: 'geom',
      },
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

    expect(datasets).toEqual({
      places: {tableName: 'main.places', transformSql: undefined},
      regions: {
        tableName: 'main.regions',
        transformSql: 'SELECT * FROM __sqlrooms_source',
      },
    });
  });
});
