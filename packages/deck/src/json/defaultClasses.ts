import {
  COORDINATE_SYSTEM,
  FirstPersonView,
  MapView,
  OrbitView,
  OrthographicView,
} from '@deck.gl/core';
import {GeoJsonLayer} from '@deck.gl/layers';
import {
  GeoArrowPathLayer,
  GeoArrowScatterplotLayer,
  GeoArrowSolidPolygonLayer,
} from '@geoarrow/deck.gl-layers';

export const DEFAULT_DECK_JSON_CLASSES = {
  MapView,
  FirstPersonView,
  OrbitView,
  OrthographicView,
  GeoJsonLayer,
  GeoArrowScatterplotLayer,
  GeoArrowPathLayer,
  GeoArrowSolidPolygonLayer,
};

export const DEFAULT_DECK_JSON_ENUMERATIONS = {
  COORDINATE_SYSTEM,
};

export const DEFAULT_DECK_JSON_CONSTANTS = {};
