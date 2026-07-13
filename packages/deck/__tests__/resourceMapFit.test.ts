import {describe, expect, test} from '@jest/globals';
import {
  createResourceMapBoundsQuery,
  getResourceMapDatasetSource,
  resolveResourceMapFitToData,
} from '../src/resourceMapFit';

describe('resource map fit', () => {
  test('resolves geometry metadata without Mosaic dashboard state', () => {
    expect(
      resolveResourceMapFitToData({
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

  test('builds bounds SQL from a resource-native table dataset', () => {
    const source = getResourceMapDatasetSource({
      tableName: 'earthquakes',
      transformSql: 'SELECT * FROM __sqlrooms_source',
    });
    expect(source).not.toBeNull();
    const query = createResourceMapBoundsQuery({
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
