import {
  COORDINATE_SYSTEM,
  FirstPersonView,
  MapView,
  OrbitView,
  OrthographicView,
} from '@deck.gl/core';
import {GeoJsonLayer} from '@deck.gl/layers';
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
