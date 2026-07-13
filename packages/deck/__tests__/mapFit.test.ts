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
});
