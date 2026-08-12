import {DECK_TABLE_DATASET_SOURCE_RELATION} from './datasets/tableDatasetSql';

/**
 * Cross-surface Deck map AI contract rules shared by dashboard and worksheet
 * prompts. Surface-specific tooling (dashboard panels vs sparse resource merge)
 * stays in the host instruction builders.
 */
export function getDeckMapSharedAiContractRules(): string {
  const src = DECK_TABLE_DATASET_SOURCE_RELATION;
  return `Shared Deck map authoring rules (dashboard and worksheet):
- Scatterplot/Heatmap/Column require Point positions — do not bind them to Polygon/MultiPolygon geom. Prefer GeoArrowPolygonLayer / GeoArrowSolidPolygonLayer, or transformSql with ST_AsWKB(ST_Centroid(geom)) / ST_PointOnSurface(geom) when the user wants points (e.g. SELECT * EXCLUDE (geom), ST_AsWKB(ST_Centroid(geom)) AS geom FROM ${src}). The runtime will not invent centroids.
- Mixed Point/LineString/Polygon columns: use GeoJsonLayer. Typed GeoArrowPolygon/Path/Scatterplot layers need a uniform geometry type. To keep one class, filter with WHERE ST_GeometryType(geom) IN (...) then use the matching typed layer.
- Never write SELECT *, ST_AsWKB(col) AS col — DuckDB keeps the original column and the WKB alias collides. Use SELECT * EXCLUDE (col), ST_AsWKB(...) AS col, or omit transformSql when geom already exists. Bare ST_Point(...) / table GEOMETRY columns are projected to WKB by the dataset pipeline; prefer explicit ST_AsWKB when practical.
- GeoArrowHeatmapLayer: omit colorRange (UI scheme selector owns it) and omit getWeight (default uniform density). Do not bind getWeight to a column — basic mode has no weight-column control.
- Never set mapStyle to a mapbox:// URL — MapLibre cannot load that scheme. Omit mapStyle for the host basemap, or use a token-free MapLibre https:// style URL.
- GeoArrowH3HexagonLayer: set getHexagon to "@@=h3_column" (or _sqlroomsBinding.hexagonColumn). When aggregating lon/lat, prefer h3_h3_to_string(h3_latlng_to_cell(lat, lon, res)) AS h3_cell (lat before lon).
- GeoArrowArcLayer: bind WKB via _sqlroomsBinding.sourceGeometryColumn / targetGeometryColumn only (do not set getSourcePosition/getTargetPosition). Use ST_AsWKB(ST_Point(...)); set geometryEncodingHint to "wkb".
- GeoArrowTripsLayer = animated path over time; GeoArrowArcLayer = static OD curve. Prefer TripsLayer for animated/trips/moving routes.`;
}
