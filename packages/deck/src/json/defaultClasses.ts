import {
  COORDINATE_SYSTEM,
  FirstPersonView,
  MapView,
  OrbitView,
  OrthographicView,
} from '@deck.gl/core';
import {ColumnLayer, GeoJsonLayer} from '@deck.gl/layers';
import {
  GeoArrowArcLayer,
  GeoArrowColumnLayer,
  _GeoArrowH3HexagonLayer as GeoArrowH3HexagonLayer,
  GeoArrowHeatmapLayer,
  GeoArrowPathLayer,
  GeoArrowPolygonLayer,
  GeoArrowScatterplotLayer,
  GeoArrowSolidPolygonLayer,
  GeoArrowTripsLayer,
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
  GeoArrowTripsLayer,
  GeoArrowH3HexagonLayer,
};

export const DEFAULT_DECK_JSON_ENUMERATIONS = {
  COORDINATE_SYSTEM,
};

export const DEFAULT_DECK_JSON_CONSTANTS = {};
