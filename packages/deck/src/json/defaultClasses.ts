import {
  COORDINATE_SYSTEM,
  FirstPersonView,
  MapView,
  OrbitView,
  OrthographicView,
} from '@deck.gl/core';
import {ColumnLayer, GeoJsonLayer} from '@deck.gl/layers';
import {H3HexagonLayer, TripsLayer} from '@deck.gl/geo-layers';
import {
  GeoArrowArcLayer,
  GeoArrowColumnLayer,
  GeoArrowHeatmapLayer,
  GeoArrowPathLayer,
  GeoArrowPolygonLayer,
  GeoArrowScatterplotLayer,
  GeoArrowSolidPolygonLayer,
} from '@geoarrow/deck.gl-layers';

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

// TODO(geoarrow-upgrade): Revisit this import surface on the next GeoArrow bump.
// Published 0.3.x uses `@geoarrow/deck.gl-layers`; newer lines may rename the package
// and/or move the exported layer classes.
//
// NOTE: GeoArrowH3HexagonLayer from @geoarrow/deck.gl-layers@0.3.2 is NOT used here.
// It is incompatible with @deck.gl/geo-layers@9.3.x: the wrapper passes binary
// attributes to the H3HexagonLayer sublayer, but the sublayer's _calculateH3DataProps
// iterates data with createIterable and calls getHexagon(object) expecting string H3
// indices. This causes "Cannot read properties of undefined (reading 'hexagon')" at
// runtime. We use the native H3HexagonLayer from @deck.gl/geo-layers instead, fed with
// row-based data via the 'row' representation. Re-enable the GeoArrow version after
// @geoarrow/deck.gl-layers publishes a compatible release.
export const DEFAULT_DECK_JSON_CLASSES = {
  MapView,
  FirstPersonView,
  OrbitView,
  OrthographicView,
  GeoJsonLayer,
  GeoArrowScatterplotLayer,
  GeoArrowHeatmapLayer,
  GeoArrowColumnLayer,
  GeoArrowPathLayer,
  GeoArrowPolygonLayer,
  GeoArrowSolidPolygonLayer,
  GeoArrowArcLayer,
  // GeoArrowTripsLayer from @geoarrow/deck.gl-layers@0.3.2 has the same binary
  // attribute incompatibility as the H3 wrapper: it passes timestamps as a raw
  // Float64Array attribute but the native TripsLayer's attribute manager fails to
  // initialize it correctly, producing "Float64Array Error: Float64Array".
  // We use the native TripsLayer from @deck.gl/geo-layers instead, fed with
  // row-based data via the 'row' representation.
  GeoArrowTripsLayer: TripsLayer,
  TripsLayer,
  H3HexagonLayer,
  GeoArrowH3HexagonLayer: H3HexagonLayer,
};

export const DEFAULT_DECK_JSON_ENUMERATIONS = {
  COORDINATE_SYSTEM,
};

export const DEFAULT_DECK_JSON_CONSTANTS = {};
