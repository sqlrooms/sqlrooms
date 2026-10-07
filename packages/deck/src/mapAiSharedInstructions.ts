import {formatColorSchemePromptLists} from '@sqlrooms/color-scales/colorSchemeNames';
import {DECK_TABLE_DATASET_SOURCE_RELATION} from './datasets/tableDatasetSql';
import {
  DECK_MAP_LAYER_CLASS_ALIASES,
  DECK_MAP_LAYER_TYPE_OPTIONS,
} from './mapLayerConfigUtils';

const SUPPORTED_LAYER_TYPES = DECK_MAP_LAYER_TYPE_OPTIONS.map(
  (option) => `${option.value} (${option.label})`,
).join(', ');

const UNPREFIXED_LAYER_ALIASES = Object.keys(DECK_MAP_LAYER_CLASS_ALIASES)
  .map((name) => `"${name}"`)
  .join(', ');

/**
 * Returns the surface-agnostic Deck map authoring contract.
 *
 * Every rule that {@link getDeckMapResourceConfigIssues} can reject, and every
 * rule describing the DuckDB-to-GeoArrow dataset pipeline, belongs here so that
 * dashboard and document prompts cannot drift apart. Surface-specific prompts
 * add only tool names, write semantics, and lifecycle rules on top of this.
 */
export function getDeckMapSharedAiContractRules(): string {
  const src = DECK_TABLE_DATASET_SOURCE_RELATION;
  return `Shared Deck map authoring rules (every map surface):

DATASETS AND SQL
- A new map must contain at least one config.datasets entry and at least one spec.layers entry.
- Every dataset must define source.tableName, source.tableName plus source.transformSql, or source.sqlQuery. Never put sql directly on the dataset object.
- transformSql must read from ${src}, not from the authored table name, so the dataset follows table selection. Use source.sqlQuery only for a standalone literal query that should stay pinned to the authored SQL.
- transformSql and sqlQuery must contain ONLY a single SELECT statement. Never include INSTALL, LOAD, CREATE, or other DDL/meta-commands — dataset SQL is wrapped in a subquery at runtime. The h3 and spatial extensions are pre-loaded at startup.
- Never write SELECT *, ST_AsWKB(col) AS col — DuckDB keeps the original column and the WKB alias collides, producing an empty map. Use SELECT * EXCLUDE (col), ST_AsWKB(...) AS col, or omit transformSql when the geometry column already exists. Bare ST_Point(...) and table GEOMETRY columns are projected to WKB by the dataset pipeline; prefer explicit ST_AsWKB when practical.
- CRITICAL geometryColumn rule: geometryColumn (in datasets[id].geometryColumn, _sqlroomsBinding.geometryColumn, and fitToData.geometryColumn) must name the exact column alias that produces WKB geometry in the FINAL query output — normally the "AS geom" alias of ST_AsWKB(...). Never set it to a GROUP BY key, an ID column, or any other non-geometry column; the layer then fails silently. For "SELECT path_id, ST_AsWKB(ST_MakeLine(...)) AS geom ... GROUP BY path_id", geometryColumn is "geom", never "path_id". Pair it with geometryEncodingHint "wkb".
- A GeoJSON (.geojson) or other spatial file loaded as a table is read through DuckDB ST_Read, producing a WKB "geom" column plus the feature properties as columns. Use source.tableName directly (no transformSql), geometryColumn "geom", and geometryEncodingHint "wkb". Such files usually hold Polygon/MultiPolygon features, so prefer a polygon layer unless the user asks for points or mixed rendering.

LAYER CLASSES AND GEOMETRY
- Supported spec.layers[].@@type values: ${SUPPORTED_LAYER_TYPES}. Always use the full GeoArrow-prefixed class name — the unprefixed names ${UNPREFIXED_LAYER_ALIASES} are not registered Deck JSON classes. Prefer a typed GeoArrow* layer when the geometry type is known; use GeoJsonLayer for mixed or generic GeoJSON/WKB features bound through _sqlroomsBinding.
- Bind every layer to a config.datasets entry with _sqlroomsBinding.dataset. Never use data: "@@#datasetId" or an implicit single-dataset binding as a durable layer binding.
- Only create a layer when the table holds data suitable for it, or when transformSql/sqlQuery can produce that shape. Do not build a path layer from point-only data without aggregation, a polygon layer from point coordinates, or an arc layer without origin-destination pairs.
- Point data (lon/lat columns or Point geometry): GeoArrowScatterplotLayer, GeoArrowHeatmapLayer, or GeoArrowColumnLayer. These require Point positions — do not bind them to Polygon/MultiPolygon geom. Prefer GeoArrowPolygonLayer for Polygon and GeoJsonLayer for WKB/WKT MultiPolygon, or use transformSql with ST_AsWKB(ST_Centroid(geom)) / ST_PointOnSurface(geom) when the user wants points (e.g. SELECT * EXCLUDE (geom), ST_AsWKB(ST_Centroid(geom)) AS geom FROM ${src}). The runtime will not invent centroids.
- Longitude/latitude columns become point geometry with transformSql, for example: "SELECT *, ST_AsWKB(ST_Point(\\"Longitude\\", \\"Latitude\\")) AS \\"__sqlrooms_geom\\" FROM ${src} WHERE \\"Longitude\\" IS NOT NULL AND \\"Latitude\\" IS NOT NULL". Set geometryColumn to the alias used in the AS clause and geometryEncodingHint to "wkb".
- Polygon data (building footprints, boundaries, areas, parcels, zones): GeoArrowPolygonLayer for uniform Polygon columns. Use GeoJsonLayer for WKB/WKT MultiPolygon columns so separate polygon parts retain their nesting.
- Mixed Point/LineString/Polygon columns: use GeoJsonLayer. Typed GeoArrowPolygon/Path/Scatterplot layers need a uniform geometry type. To keep one class, filter with WHERE ST_GeometryType(geom) IN (...) then use the matching typed layer.
- Line data (roads, routes, paths, rivers): GeoArrowPathLayer. Requires LineString geometry (or a single-part MultiLineString); explode or merge multi-part MultiLineString with ST_Dump / ST_LineMerge first. If linestring geom already exists, use it directly (or SELECT * EXCLUDE (geom), ST_AsWKB(geom) AS geom ... WHERE ST_GeometryType(geom) = 'LINESTRING'). For one row per waypoint (path_id/route_id + order + lon/lat), aggregate with transformSql: "SELECT path_id, label, ST_AsWKB(ST_MakeLine(LIST(ST_Point(lon, lat) ORDER BY waypoint_order))) AS geom FROM ${src} GROUP BY path_id, label".
- ST_MakeLine is a scalar that takes a LIST of points. Always write ST_MakeLine(LIST(ST_Point(...) ORDER BY ...)) — never ST_MakeLine(ST_Point(...) ORDER BY ...), because ORDER BY is only valid inside LIST. Any LIST(...)/ST_MakeLine waypoint aggregation must GROUP BY the trip/path/route id so each trip becomes one linestring; without GROUP BY the waypoints are not split per trip.
- Animated trip data (routes with timestamps): GeoArrowTripsLayer, one row per trip with LineString geom plus a timestamps list in the same order and length as the vertices. Set geometryColumn "geom", geometryEncodingHint "wkb", and _sqlroomsBinding.timestampColumn to the timestamps list column (required).
    (1) Waypoint rows (trip_id/path_id + lon/lat + order/time): GROUP BY the trip id, e.g. "SELECT trip_id, ANY_VALUE(label) AS label, ST_AsWKB(ST_MakeLine(LIST(ST_Point(lon, lat) ORDER BY waypoint_order))) AS geom, LIST(timestamp ORDER BY waypoint_order) AS timestamps FROM ${src} GROUP BY trip_id". Keep other attributes with ANY_VALUE(col).
    (2) OD pairs already one row per trip: no GROUP BY, e.g. "SELECT trip_id, ST_AsWKB(ST_MakeLine([ST_Point(pickup_lon, pickup_lat), ST_Point(dropoff_lon, dropoff_lat)])) AS geom, [0.0, 1.0] AS timestamps FROM ${src}" (prefer [0.0, duration] when available).
- Arc data (origin-destination pairs, connections, flows, OD links): GeoArrowArcLayer. Bind WKB endpoints through _sqlroomsBinding.sourceGeometryColumn / targetGeometryColumn only — never set getSourcePosition/getTargetPosition. Use ST_AsWKB(ST_Point(...)) and geometryEncodingHint "wkb", e.g. "SELECT *, ST_AsWKB(ST_Point(source_lon, source_lat)) AS source_geom, ST_AsWKB(ST_Point(target_lon, target_lat)) AS target_geom FROM ${src}". For H3 OD pairs use h3_cell_to_lng/h3_cell_to_lat inside ST_Point (not h3_latlng).
- GeoArrowTripsLayer = animated path over time; GeoArrowArcLayer = static OD curve. Prefer TripsLayer for animated/trips/moving routes. Arcs are curved 3D by default: set "getHeight": 0 for flat straight lines when the user asks for lines, edges, or direct connections rather than arcs.
- H3 hexagon data: GeoArrowH3HexagonLayer with getHexagon set to "@@=h3_column" (or _sqlroomsBinding.hexagonColumn); object accessors are not valid. When aggregating lon/lat, prefer h3_h3_to_string(h3_latlng_to_cell(lat, lon, res)) AS h3_cell (lat before lon). Valid helpers are h3_cell_to_lat/lng/latlng — not h3_latlng/h3_to_lat.
- GeoArrowHeatmapLayer: omit colorRange (the UI scheme selector owns it) and omit getWeight (default uniform density). Do not bind getWeight to a column — basic mode has no weight-column control.

SIZES, ELEVATION, AND CAMERA
- GeoArrowScatterplotLayer: numeric getRadius with radiusUnits "pixels" (typically 2–6). Never use string expressions like "field * 500" in basic mode — they bypass pixel clamping. Data-driven size is "@@=columnName" in configMode "custom" only, with radiusUnits meters so radiusMaxPixels can cap it.
- GeoArrowColumnLayer: use "radius" in meters (not getRadius/radiusUnits), typically 20–200. Arc/Path/Trips: numeric getWidth with widthUnits "pixels" (typically 1–3). GeoArrowHeatmapLayer: numeric radiusPixels (e.g. 30).
- ELEVATION: set "extruded": true whenever getElevation is used. Prefer getElevation {"@@function":"scale","field":"...","type":"linear","domain":"auto","range":[0,200]} (basic-mode friendly) or "@@=columnName" when that column is already height in meters. Omit elevationScale. The scale range is already meters, and elevationScale multiplies it again — a second factor such as 50–100 makes columns tens of kilometers tall. Never use negative elevation. For polygon building footprints rendered with GeoArrowColumnLayer, produce points with the centroid rule above.
- 3D CAMERA: For H3/columns unless extruded is false (omitted counts as extruded), extruded polygons, or arcs unless getHeight is 0, set spec.initialViewState with pitch 45–60 and optional bearing (e.g. {"pitch":50,"bearing":20}). Allowed in basic mode. Top-down pitch 0 makes columns look like flat disks and appear "missing". Omit pitch for flat 2D maps.

COLOR
- Data-driven color uses {"@@function":"colorScale","field":"<column>","type":"sequential"|"diverging"|"quantize"|"quantile"|"threshold"|"categorical","scheme":"<name>","domain":"auto"} on getFillColor, getLineColor, getColor, getSourceColor, or getTargetColor. The key is "@@function" (not "@@type"), and the column goes in "field" (not "column"). "field" must be the exact schema column name (case-sensitive: "Magnitude", not "mag") and must exist in the FINAL query output after any GROUP BY. type "threshold" also requires a non-empty numeric "thresholds" array.
- Exact scheme names (case-sensitive): ${formatColorSchemePromptLists()} — do not invent names. Viridis/Plasma/Inferno/Turbo/Cividis/Magma require type "sequential"; quantile/quantize/threshold schemes must be ColorBrewer binned ramps such as YlOrRd, Blues, Greens, or RdYlBu.
- COLOR SCALE FIELD VARIANCE: Prefer colorScale over flat fill when a useful varying column exists — numeric to sequential (uniform) or quantile (skewed), categorical/string to categorical. Before choosing a numeric field, confirm it has real range (min < max, not all zeros or a single constant); use SUMMARIZE table_name or SELECT min(col), max(col), count(DISTINCT col) FROM ... when unsure. Do NOT color by a flat column, and use a flat fill color instead when no varying column exists. Categorical fields need more than one distinct non-null value. Geometry, lon/lat, H3 index, and opaque ID columns are not useful color fields. If the user explicitly names a column, honor it even when flat; use flat fill when the user asks for one color.
- Enabling a color scale means adding the {"@@function":"colorScale", ...} accessor to a compatible layer color property. The top-level showLegends field only controls whether already-defined legends are visible; it does NOT by itself create or enable data-driven color.

VIEW FITTING AND BASEMAP
- fitToData must be a FLAT object with "dataset" as a string field — never nested as {"datasetId": {...}}. Add geometryColumn for WKB geometry ({"dataset":"d","geometryColumn":"geom"}) or longitudeColumn+latitudeColumn for separate coordinate columns. For H3 and arc layers {"dataset":"d"} is enough; the H3, source, and target columns are inferred from the layer binding. Always include fitToData for H3 hexagon maps and for spatial files, so the view zooms to the data extent.
- Omit fitToData.maxZoom unless the user asks to cap zoom-in. A low cap (e.g. 12) leaves local data such as buildings and neighborhoods looking far too zoomed out.
- Never set mapStyle to a mapbox:// URL — MapLibre cannot load that scheme. Omit mapStyle for the host basemap, or use a token-free MapLibre https:// style URL.
- Built-in mapStyle IDs are light and dark. New maps default to the app theme at creation; omit mapStyle on updates to preserve the saved selection. Never put tile API keys in map configs.

CONFIG MODE AND SCOPE
- Every map config must include configMode ("basic" or "custom"), which determines how the map was authored and whether the UI settings panel is available.
  - "basic" (default): single layer, standard color scale, simple geometry binding. Stick to properties the UI configurator supports: layer @@type, visibility, colorScale accessors, numeric getRadius/getWidth/radiusPixels/radius, geometry/H3/arc column bindings, and extrusion with a single elevation column ("@@=columnName" or a scale accessor). Do NOT use free-form string expressions (e.g. "floors * 3"), custom extensions, multiple layers, or advanced deck.gl props. The user can fine-tune these maps through the settings panel.
  - "custom": multiple layers, free-form data-driven accessors, custom color arrays, advanced deck.gl props (opacity, transitions, material, highlightColor), layer extensions, or anything else the UI configurator cannot represent. The settings panel is disabled for custom configs; users edit JSON instead. Custom mode does not relax dataset-source or layer-binding requirements.
  - Decision rule: if the map can be fully expressed with a single layer, a basic color scale, numeric radius/width, and an optional single elevation column, use "basic". Extruded GeoArrowColumnLayer and polygon maps with one elevation field must stay "basic" so the settings panel remains available.
- Create maps with a SINGLE layer unless the user explicitly asks for multiple layers. If multiple layers would serve the request better, ask the user to confirm first.
- Browsers limit active WebGL contexts (typically 8–16 per page) and every rendered map uses one. Do NOT create more than 4–5 maps on a single page — exceeding the limit makes older maps lose their rendering context and show errors. For many datasets, prefer combining compatible layers into fewer maps over one map per dataset.
- When switching a layer type, send only the new layer. Never keep the old layer as visible: false.
- Maps default to a 100000-row runtime data limit; set config.dataPolicy.maxRows only when a map genuinely needs its own limit.`;
}
