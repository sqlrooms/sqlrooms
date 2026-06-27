import {CompositeLayer, type Layer, type LayersList} from '@deck.gl/core';
import * as arrow from 'apache-arrow';

type GeoArrowLayerClass = new (props: Record<string, unknown>) => Layer;

/**
 * Creates a wrapper layer class that adapts the 0.4.x GeoArrow layer API
 * (which expects `data: RecordBatch` and geometry as `arrow.Data`) to accept
 * the Table + Vector format used by our JSON pipeline.
 *
 * The wrapper splits a multi-batch Table into per-batch sublayers, converting
 * each Vector prop into its corresponding Data chunk.
 */
export function createTableToRecordBatchAdapter(
  UpstreamLayer: GeoArrowLayerClass,
  layerName: string,
) {
  class Adapter extends CompositeLayer<{
    data: arrow.Table | arrow.RecordBatch;
    [key: string]: unknown;
  }> {
    static layerName = layerName;

    renderLayers(): Layer | LayersList | null {
      const {data, ...otherProps} = this.props;

      if (!data) return null;

      // If already a RecordBatch, pass through directly
      if (data instanceof arrow.RecordBatch) {
        return new UpstreamLayer({
          ...otherProps,
          id: `${this.props.id}-0`,
          data,
        } as Record<string, unknown>);
      }

      // Must be an arrow.Table — split into per-batch sublayers
      if (!(data instanceof arrow.Table)) return null;

      const table = data;
      const batches = table.batches;
      if (!batches.length) return null;

      const layers: Layer[] = [];
      for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        const batch = batches[batchIdx]!;
        const batchProps: Record<string, unknown> = {
          id: `${this.props.id}-${batchIdx}`,
          data: batch,
        };

        for (const [propName, propValue] of Object.entries(otherProps)) {
          if (propName === 'id') continue;
          if (propValue instanceof arrow.Vector) {
            // Convert Vector chunk to Data for this batch
            const chunkData = propValue.data[batchIdx];
            if (chunkData) {
              batchProps[propName] = chunkData;
            }
          } else {
            batchProps[propName] = propValue;
          }
        }

        layers.push(new UpstreamLayer(batchProps));
      }

      return layers;
    }
  }

  return Adapter as unknown as GeoArrowLayerClass;
}
