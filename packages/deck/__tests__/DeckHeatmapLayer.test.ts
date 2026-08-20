import {DEFAULT_HEATMAP_WEIGHTS_TEXTURE_SIZE} from '../src/json/heatmapDefaults';
import {
  DeckHeatmapLayer,
  reuseCachedHeatmapData,
} from '../src/json/layers/DeckHeatmapLayer';

describe('DeckHeatmapLayer', () => {
  it('keeps the GeoArrow heatmap class name for JSONConverter', () => {
    expect(DeckHeatmapLayer.layerName).toBe('GeoArrowHeatmapLayer');
    expect(DeckHeatmapLayer.defaultProps.weightsTextureSize).toEqual(
      expect.objectContaining({value: DEFAULT_HEATMAP_WEIGHTS_TEXTURE_SIZE}),
    );
    expect(DEFAULT_HEATMAP_WEIGHTS_TEXTURE_SIZE).toBe(512);
  });

  it('reuses the inner heatmap data wrapper when only radius changes', () => {
    const table = {id: 1};
    const getPosition = {id: 'pos'};
    const firstData = {length: 4};
    const cache = reuseCachedHeatmapData(
      undefined,
      {data: table, getPosition, radiusPixels: 30},
      firstData,
    );
    const reused = reuseCachedHeatmapData(
      cache,
      {data: table, getPosition, radiusPixels: 80},
      {length: 4},
    );

    expect(reused.data).toBe(firstData);
  });

  it('reuses the inner heatmap data wrapper when only the colormap changes', () => {
    const table = {id: 1};
    const getPosition = {id: 'pos'};
    const firstData = {length: 4};
    const cache = reuseCachedHeatmapData(
      undefined,
      {data: table, getPosition, colorRange: [[255, 0, 0, 255]]},
      firstData,
    );

    expect(
      reuseCachedHeatmapData(
        cache,
        {data: table, getPosition, colorRange: [[0, 0, 255, 255]]},
        {length: 4},
      ).data,
    ).toBe(firstData);
  });

  it('rebuilds the inner heatmap data wrapper when getWeight changes', () => {
    const table = {id: 1};
    const getPosition = {id: 'pos'};
    const nextData = {length: 4};
    const cache = reuseCachedHeatmapData(
      undefined,
      {data: table, getPosition, getWeight: 1},
      {length: 4},
    );

    expect(
      reuseCachedHeatmapData(
        cache,
        {data: table, getPosition, getWeight: 2},
        nextData,
      ).data,
    ).toBe(nextData);
  });

  it('rebuilds the inner heatmap data wrapper when the table changes', () => {
    const firstData = {length: 3};
    const cache = reuseCachedHeatmapData(
      undefined,
      {data: {id: 1}, getPosition: {id: 'a'}},
      firstData,
    );
    const nextData = {length: 5};
    const rebuilt = reuseCachedHeatmapData(
      cache,
      {data: {id: 2}, getPosition: {id: 'b'}},
      nextData,
    );

    expect(rebuilt.data).toBe(nextData);
  });
});
