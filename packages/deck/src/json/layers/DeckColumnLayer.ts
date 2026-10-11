import {ColumnLayer} from '@deck.gl/layers';
import {GeoArrowColumnLayer} from '@geoarrow/deck.gl-geoarrow';
import {createTableToRecordBatchAdapter} from './createTableToRecordBatchAdapter';

// Workaround for deck.gl bug #10021: the ColumnLayer's wireframe index buffer
// leaks onto the fill model when using binary data (as GeoArrow does), causing
// the fill model to render with line-list indices instead of triangle-strip.
// This produces half-rendered columns with missing caps.
// See: https://github.com/visgl/deck.gl/pull/10094
const originalColumnDraw = ColumnLayer.prototype.draw;
ColumnLayer.prototype.draw = function (opts: {uniforms: unknown}) {
  const fillModel = (
    this as unknown as {
      state: {
        fillModel: {
          vertexArray: {indexBuffer: unknown};
          setIndexBuffer: (b: null) => void;
        };
      };
    }
  ).state.fillModel;
  if (fillModel?.vertexArray?.indexBuffer) {
    fillModel.setIndexBuffer(null);
  }
  return originalColumnDraw.call(this, opts);
};

/**
 * GeoArrowColumnLayer adapter that accepts Table + Vector data (the format
 * used by our JSON pipeline) and bridges to the 0.4.x RecordBatch API.
 * Also includes a fix for the deck.gl ColumnLayer wireframe index buffer
 * bug (#10021).
 *
 * Remove the prototype patch once deck.gl includes the upstream fix (PR #10094).
 */
export const DeckColumnLayer = createTableToRecordBatchAdapter(
  GeoArrowColumnLayer as any,
  'GeoArrowColumnLayer',
);
