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
} from '@geoarrow/deck.gl-geoarrow';
import {createTableToRecordBatchAdapter} from './layers/createTableToRecordBatchAdapter';
import {DeckColumnLayer, DeckH3HexagonLayer, DeckTripsLayer} from './layers';

// The 0.4.x GeoArrow layers expect `data: RecordBatch` + geometry as `Data`,
// but our JSON pipeline passes `data: Table` + geometry as `Vector`.
// These adapters bridge the gap by splitting Table batches into sublayers.
const AdaptedScatterplotLayer = createTableToRecordBatchAdapter(
  GeoArrowScatterplotLayer as any,
  'GeoArrowScatterplotLayer',
);
const AdaptedHeatmapLayer = createTableToRecordBatchAdapter(
  GeoArrowHeatmapLayer as any,
  'GeoArrowHeatmapLayer',
);
const AdaptedPathLayer = createTableToRecordBatchAdapter(
  GeoArrowPathLayer as any,
  'GeoArrowPathLayer',
);
const AdaptedPolygonLayer = createTableToRecordBatchAdapter(
  GeoArrowPolygonLayer as any,
  'GeoArrowPolygonLayer',
);
const AdaptedSolidPolygonLayer = createTableToRecordBatchAdapter(
  GeoArrowSolidPolygonLayer as any,
  'GeoArrowSolidPolygonLayer',
);
const AdaptedArcLayer = createTableToRecordBatchAdapter(
  GeoArrowArcLayer as any,
  'GeoArrowArcLayer',
);

export const DEFAULT_DECK_JSON_CLASSES: Record<
  string,
  new (props: Record<string, unknown>) => unknown
> = {
  MapView,
  FirstPersonView,
  OrbitView,
  OrthographicView,
  GeoJsonLayer,
  GeoArrowScatterplotLayer: AdaptedScatterplotLayer,
  GeoArrowHeatmapLayer: AdaptedHeatmapLayer,
  GeoArrowColumnLayer: DeckColumnLayer,
  GeoArrowPathLayer: AdaptedPathLayer,
  GeoArrowPolygonLayer: AdaptedPolygonLayer,
  GeoArrowSolidPolygonLayer: AdaptedSolidPolygonLayer,
  GeoArrowArcLayer: AdaptedArcLayer,
  GeoArrowTripsLayer: DeckTripsLayer,
  GeoArrowH3HexagonLayer: DeckH3HexagonLayer,
};

export const DEFAULT_DECK_JSON_ENUMERATIONS = {
  COORDINATE_SYSTEM,
};

export const DEFAULT_DECK_JSON_CONSTANTS = {};
