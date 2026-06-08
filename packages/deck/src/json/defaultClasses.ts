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
  GeoArrowHeatmapLayer,
  GeoArrowPathLayer,
  GeoArrowPolygonLayer,
  GeoArrowScatterplotLayer,
  GeoArrowSolidPolygonLayer,
} from '@geoarrow/deck.gl-layers';
import {SqlroomsColumnLayer} from './SqlroomsColumnLayer';
import {SqlroomsH3HexagonLayer} from './SqlroomsH3HexagonLayer';
import {SqlroomsTripsLayer} from './SqlroomsTripsLayer';

// TODO(geoarrow-upgrade): Revisit this import surface on the next GeoArrow bump.
// Published 0.3.x uses `@geoarrow/deck.gl-layers`; newer lines may rename the package
// and/or move the exported layer classes.
//
// NOTE: GeoArrowTripsLayer and GeoArrowH3HexagonLayer from @geoarrow/deck.gl-layers@0.3.2
// are incompatible with @deck.gl@9.3.x. We use our own wrappers that properly interface
// Arrow data with the native deck.gl layers. See SqlroomsTripsLayer.ts and
// SqlroomsH3HexagonLayer.ts for details.
export const DEFAULT_DECK_JSON_CLASSES = {
  MapView,
  FirstPersonView,
  OrbitView,
  OrthographicView,
  GeoJsonLayer,
  GeoArrowScatterplotLayer,
  GeoArrowHeatmapLayer,
  GeoArrowColumnLayer: SqlroomsColumnLayer,
  GeoArrowPathLayer,
  GeoArrowPolygonLayer,
  GeoArrowSolidPolygonLayer,
  GeoArrowArcLayer,
  GeoArrowTripsLayer: SqlroomsTripsLayer,
  GeoArrowH3HexagonLayer: SqlroomsH3HexagonLayer,
};

export const DEFAULT_DECK_JSON_ENUMERATIONS = {
  COORDINATE_SYSTEM,
};

export const DEFAULT_DECK_JSON_CONSTANTS = {};
