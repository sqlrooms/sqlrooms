import {getFlatLayerOrder} from '@kepler.gl/reducers';
import type {Layer} from '@kepler.gl/layers';
import type {LayerOrder} from '@kepler.gl/types';
import {Fragment} from 'react';
import type {ReactNode} from 'react';

/** Returns layers in the display order represented by Kepler's hierarchy. */
export function orderLayersForLegend(
  layers: readonly Layer[],
  layerOrder: LayerOrder | undefined,
): Layer[] {
  if (!layerOrder) return [...layers];

  const layersById = new Map(layers.map((layer) => [layer.id, layer]));
  return getFlatLayerOrder(layerOrder).flatMap((id) => {
    const layer = layersById.get(id);
    return layer ? [layer] : [];
  });
}

type LegendLayerListProps = {
  layers: readonly Layer[];
  layerOrder: LayerOrder | undefined;
  isExport?: boolean;
  children: (layer: Layer, isExport: boolean | undefined) => ReactNode;
};

/** Renders visible legend layers in Kepler's hierarchical display order. */
export function LegendLayerList({
  layers,
  layerOrder,
  isExport,
  children,
}: LegendLayerListProps) {
  return orderLayersForLegend(layers, layerOrder)
    .filter((layer) => layer.config.isVisible)
    .map((layer) => (
      <Fragment key={layer.id}>{children(layer, isExport)}</Fragment>
    ));
}
