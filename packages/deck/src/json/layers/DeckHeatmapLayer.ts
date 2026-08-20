import type {Layer, LayersList} from '@deck.gl/core';
import {GeoArrowHeatmapLayer} from '@geoarrow/deck.gl-geoarrow';
import {DEFAULT_HEATMAP_WEIGHTS_TEXTURE_SIZE} from '../heatmapDefaults';

type HeatmapDataCache = {
  sourceData: unknown;
  sourcePosition: unknown;
  weightKey: unknown;
  data: unknown;
};

type LayerWithData = Layer & {props: {data?: unknown}};

/**
 * GeoArrow heatmap composite that keeps the inner binary `data` object stable
 * across style-only updates (radius, opacity, colormap).
 *
 * JSONConverter always constructs new layer instances; deck.gl LayerManager
 * matches them by `id` and transfers GPU state. The expensive part is
 * GeoArrow allocating a new `{attributes: {getPosition}}` wrapper on every
 * `renderLayers()` call, which the inner heatmap treats as a data change and
 * rebuilds aggregation. This subclass reuses the previous wrapper when the
 * Arrow table / position / weight inputs are unchanged.
 */
export class DeckHeatmapLayer extends GeoArrowHeatmapLayer {
  static layerName = 'GeoArrowHeatmapLayer';
  static defaultProps = {
    weightsTextureSize: {
      type: 'number' as const,
      min: 128,
      max: 2048,
      value: DEFAULT_HEATMAP_WEIGHTS_TEXTURE_SIZE,
    },
  };

  declare state: {heatmapDataCache?: HeatmapDataCache};

  renderLayers(): Layer | LayersList | null {
    const rendered = super.renderLayers();
    const heatmap = unwrapSingleLayer(rendered);
    if (!heatmap) return rendered;

    const cache = reuseCachedHeatmapData(
      this.state?.heatmapDataCache,
      this.props as Record<string, unknown>,
      heatmap.props.data,
    );
    if (this.state?.heatmapDataCache !== cache) {
      this.state = {...this.state, heatmapDataCache: cache};
    }
    if (cache.data === heatmap.props.data) {
      return heatmap;
    }

    const HeatmapClass = heatmap.constructor as new (
      props: Record<string, unknown>,
    ) => Layer;
    return new HeatmapClass({
      ...heatmap.props,
      data: cache.data,
    });
  }
}

/**
 * Return the previous inner heatmap `data` object when Arrow inputs match.
 */
export function reuseCachedHeatmapData(
  cache: HeatmapDataCache | undefined,
  props: Record<string, unknown>,
  nextData: unknown,
): HeatmapDataCache {
  const sourceData = props.data;
  const sourcePosition = props.getPosition;
  const weightKey = getHeatmapWeightKey(props);
  if (
    cache &&
    cache.sourceData === sourceData &&
    cache.sourcePosition === sourcePosition &&
    cache.weightKey === weightKey
  ) {
    return cache;
  }
  return {sourceData, sourcePosition, weightKey, data: nextData};
}

function getHeatmapWeightKey(props: Record<string, unknown>): unknown {
  const getWeight = props.getWeight;
  const triggers = props.updateTriggers;
  if (triggers && typeof triggers === 'object' && 'getWeight' in triggers) {
    return (triggers as Record<string, unknown>).getWeight;
  }
  if (typeof getWeight === 'number' || getWeight == null) {
    return getWeight ?? 1;
  }
  return getWeight;
}

function unwrapSingleLayer(rendered: unknown): LayerWithData | null {
  const layers = Array.isArray(rendered) ? rendered : [rendered];
  const layer = layers[0];
  if (layer && typeof layer === 'object' && 'props' in layer) {
    return layer as LayerWithData;
  }
  return null;
}
