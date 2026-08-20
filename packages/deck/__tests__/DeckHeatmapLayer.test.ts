import {
  Field,
  FixedSizeList,
  Float64,
  Schema,
  Table,
  vectorFromArray,
} from 'apache-arrow';
import {DEFAULT_HEATMAP_WEIGHTS_TEXTURE_SIZE} from '../src/json/heatmapDefaults';
import {
  DeckHeatmapLayer,
  reuseCachedHeatmapData,
} from '../src/json/layers/DeckHeatmapLayer';

function createPointTable(numRows = 4) {
  const pointField = new Field(
    'geom',
    new FixedSizeList(2, new Field('xy', new Float64())),
    true,
    new Map([['ARROW:extension:name', 'geoarrow.point']]),
  );
  return new Table(new Schema([pointField]), {
    geom: vectorFromArray(
      Array.from({length: numRows}, (_, i) => [i, i + 1]),
      pointField.type,
    ),
  });
}

describe('DeckHeatmapLayer', () => {
  it('keeps the GeoArrow heatmap class and deck.gl default weights texture size', () => {
    expect(DeckHeatmapLayer.layerName).toBe('GeoArrowHeatmapLayer');
    expect(DeckHeatmapLayer.defaultProps.weightsTextureSize).toEqual(
      expect.objectContaining({value: DEFAULT_HEATMAP_WEIGHTS_TEXTURE_SIZE}),
    );
    expect(DEFAULT_HEATMAP_WEIGHTS_TEXTURE_SIZE).toBe(2048);
  });

  it('reuses the inner heatmap data wrapper when only radius changes', () => {
    const table = createPointTable();
    const getPosition = table.getChild('geom');
    const firstData = {
      length: 4,
      attributes: {getPosition: {value: new Float64Array(8), size: 2}},
    };
    const cache = reuseCachedHeatmapData(
      undefined,
      {data: table, getPosition, radiusPixels: 30},
      firstData,
    );

    const nextData = {
      length: 4,
      attributes: {getPosition: {value: new Float64Array(8), size: 2}},
    };
    const reused = reuseCachedHeatmapData(
      cache,
      {data: table, getPosition, radiusPixels: 80},
      nextData,
    );

    expect(reused.data).toBe(firstData);
    expect(reused.data).not.toBe(nextData);
  });

  it('rebuilds the inner heatmap data wrapper when the table changes', () => {
    const table = createPointTable(3);
    const firstData = {length: 3};
    const cache = reuseCachedHeatmapData(
      undefined,
      {data: table, getPosition: table.getChild('geom')},
      firstData,
    );

    const nextTable = createPointTable(5);
    const nextData = {length: 5};
    const rebuilt = reuseCachedHeatmapData(
      cache,
      {data: nextTable, getPosition: nextTable.getChild('geom')},
      nextData,
    );

    expect(rebuilt.data).toBe(nextData);
  });
});
