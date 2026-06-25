import {tool, type Tool} from 'ai';
import {z} from 'zod';
import {
  DashboardAiAdapter,
  MAP_TOOL_KEY,
  createDashboardAgentTool,
  createDashboardAiTools as createMosaicDashboardAiTools,
  type CreateDashboardAgentToolOptions,
  type CreateDashboardAiToolsOptions,
  ensureTable,
  ensurePanel,
  DatabaseAiAdapter,
  ExtraDashboardAiToolsFactory,
  ExtraDashboardAiToolsParams,
  MosaicDashboardStoreState,
} from '@sqlrooms/mosaic';
import {
  createDeckMapDashboardPanelConfig,
  DECK_MAP_DASHBOARD_PANEL_TYPE,
  type DeckMapDashboardPanelConfig,
} from './dashboardConfig';
import {quoteDeckMapSqlIdentifier} from './mapConfigUtils';

function splitIdentifierPathOutsideQuotes(input: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const ch of input) {
    if (ch === '"') inQuotes = !inQuotes;
    if (ch === '.' && !inQuotes) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts.filter(Boolean);
}

export const DECK_MAP_AI_INSTRUCTIONS = `
Deck map tools:
- create_deck_map_config validates and returns a reusable native Deck JSON map config without requiring a dashboard artifact.
- create_dashboard_map creates or updates an interactive map panel inside a dashboard from a native Deck JSON map config.
- Use map tools when the user asks for a map, geospatial/spatial visualization, locations, longitude/latitude data, or geometry columns.
- Author maps with config.spec.layers using Deck JSON layer classes in @@type, such as GeoArrowScatterplotLayer, GeoArrowHeatmapLayer, GeoArrowPolygonLayer, GeoArrowPathLayer, GeoArrowTripsLayer, GeoArrowArcLayer, or GeoArrowH3HexagonLayer.
- LAYER SELECTION: Choose the layer type based on the geometry type in the data.
  IMPORTANT: Only create a layer if the table contains data suitable for that layer type, or if you can transform the data into the required format with a sqlQuery. Do NOT create a layer if the data is clearly incompatible (e.g. do not create a path layer from point-only data without aggregation, do not create a polygon layer from point coordinates, do not create an arc layer without origin-destination pairs).
  - Point data (lon/lat coordinates, point geometry): GeoArrowScatterplotLayer (Point layer), GeoArrowHeatmapLayer, GeoArrowColumnLayer. Requires rows with individual point positions — either separate longitude/latitude numeric columns, or a point geometry column. Each row represents one point on the map.
  - Polygon data (building footprints, boundaries, areas, parcels, zones): GeoArrowPolygonLayer or GeoArrowSolidPolygonLayer. Requires a geometry column containing polygon or multipolygon WKB/GeoArrow data. Typically loaded from GeoJSON/Shapefile/GeoParquet or produced by spatial queries. Do NOT use for point data.
  - Line data (roads, routes, paths, rivers): GeoArrowPathLayer. CRITICAL: GeoArrowPathLayer requires LineString geometry, NOT individual point rows. If the table has one row per waypoint (indicated by columns like path_id/route_id + order/sequence + lat/lon), you MUST aggregate them with a sqlQuery: "SELECT path_id, label, ST_AsWKB(ST_MakeLine(LIST(ST_Point(lon, lat) ORDER BY waypoint_order))) AS geom FROM tableName GROUP BY path_id, label". Set geometryColumn to "geom" and geometryEncodingHint to "wkb". If the table already has a geometry/geom column with linestring data, use it directly with tableName. NEVER pass raw waypoint rows to GeoArrowPathLayer — it will fail.
  - Animated trip data (routes with timestamps): GeoArrowTripsLayer. Same geometry requirements as GeoArrowPathLayer (LineString), plus a timestamps column. The sqlQuery MUST aggregate both the geometry and timestamps: "SELECT path_id, label, ST_AsWKB(ST_MakeLine(LIST(ST_Point(lon, lat) ORDER BY waypoint_order))) AS geom, LIST(timestamp ORDER BY waypoint_order) AS timestamps FROM tableName GROUP BY path_id, label". Set geometryColumn to "geom", geometryEncodingHint to "wkb", and _sqlroomsBinding.timestampColumn to "timestamps". The timestamps column must be a list of numbers (seconds) matching the order of waypoints in the linestring. Also set currentTime on the layer to control animation position. Do NOT use unless the data has or can produce both paths and ordered timestamps.
- CRITICAL geometryColumn rule: The geometryColumn field (in datasets[id].geometryColumn, _sqlroomsBinding.geometryColumn, and fitToData.geometryColumn) MUST match the exact column alias that produces the WKB geometry in the sqlQuery output — typically the "AS geom" alias in ST_AsWKB(...) AS geom. It must NEVER be set to a GROUP BY key, an ID column, or any other non-geometry column. For example, if the sqlQuery is "SELECT path_id, ST_AsWKB(ST_MakeLine(...)) AS geom ... GROUP BY path_id", geometryColumn must be "geom" (the geometry output), NOT "path_id" (the grouping key). Setting geometryColumn to a non-geometry column will cause the layer to fail silently.
  - Arc data (origin-destination pairs): GeoArrowArcLayer. Requires two sets of coordinates per row (source and target). The table must have source_lon/source_lat AND target_lon/target_lat columns (or equivalent). The dataset source MUST use a sqlQuery that creates WKB geometry columns from lat/lon, for example: "SELECT *, ST_AsWKB(ST_Point(source_lon, source_lat)) AS source_geom, ST_AsWKB(ST_Point(target_lon, target_lat)) AS target_geom FROM tableName". Set sourceGeometryColumn to "source_geom" and targetGeometryColumn to "target_geom". Set geometryEncodingHint to "wkb". To render straight lines instead of arcs, set "getHeight": 0 on the layer. Do NOT use for data with only one set of coordinates per row. When the source data has H3 indices instead of lat/lon, convert H3 to coordinates using h3_cell_to_lng(h3_index) and h3_cell_to_lat(h3_index) (the H3 extension is pre-loaded at startup), for example: "SELECT *, ST_AsWKB(ST_Point(h3_cell_to_lng(source_h3), h3_cell_to_lat(source_h3))) AS source_geom, ST_AsWKB(ST_Point(h3_cell_to_lng(target_h3), h3_cell_to_lat(target_h3))) AS target_geom FROM tableName". Do NOT use h3_latlng() — it does not exist.
  - H3 hexagon data (h3 index column): GeoArrowH3HexagonLayer. Requires a column containing H3 string indices. Bind to dataset with _sqlroomsBinding.dataset. Set "getHexagon": "@@=h3_column_name" where h3_column_name is the column containing H3 string indices. Always include "fitToData": {"dataset": "datasetId"} so the map can zoom to the data extent. Do NOT use unless the table has an H3 index column. DuckDB H3 extension functions: h3_cell_to_lat(index), h3_cell_to_lng(index), h3_cell_to_latlng(index). Do NOT use h3_latlng(), h3_to_lat(), or other non-existent function names.
- CRITICAL: The sqlQuery field must contain ONLY a single SELECT statement. NEVER put INSTALL, LOAD, CREATE, or other DDL/meta-commands in sqlQuery — they will fail because sqlQuery is wrapped in a subquery at runtime. Extensions like h3 and spatial are pre-loaded at startup.
  - GeoJSON files typically contain polygon or multipolygon features (boundaries, buildings, parcels); use GeoArrowPolygonLayer for these. If a GeoJSON file contains point features, use GeoArrowScatterplotLayer (Point layer) instead.
- RADIUS AND WIDTH: For GeoArrowScatterplotLayer (Point layer) use getRadius with radiusUnits: "pixels" (typically 2–6 pixels); large radii cause overdraw and rendering lag, especially with many points. For GeoArrowColumnLayer use the "radius" property (NOT getRadius) — it sets column radius in meters; typical values are 20–200 for city-scale data or smaller for dense datasets. Do NOT use getRadius or radiusUnits on column layers. For GeoArrowArcLayer, GeoArrowPathLayer, and GeoArrowTripsLayer use getWidth with widthUnits: "pixels" (typically 1–3 pixels).
- HEATMAP: For GeoArrowHeatmapLayer, do NOT set colorRange manually. The UI provides a scheme selector that generates the correct color array. If you set colorRange to hand-picked RGB arrays, it will be out of sync with the scheme selector shown in the UI. Just omit colorRange entirely and let the default apply — users can change the scheme through the map settings panel.
- ARC vs LINE: GeoArrowArcLayer renders curved 3D arcs by default. If the user asks for "lines" or "straight connections" between origin-destination pairs (not arcs), set "getHeight": 0 on the layer to render flat straight lines. Use arcs for flight routes or connections where the curve adds clarity; use flat lines for direct relationships, edges, or when the user explicitly requests lines.
- ELEVATION: For extruded layers, getElevation with @@function "scale" passes the raw field value as meters. Use elevationScale on the layer to multiply values to a useful visual height. For example, if the field is "floors" (1-10), set elevationScale to 3 (meters per floor). Do NOT use negative values for elevation. Avoid using diverging scales for elevation. IMPORTANT: Keep elevation moderate — if extruded polygons or H3 hexagons are too tall, users can't see the tops when zoomed in. Prefer elevationScale values that produce heights of a few hundred meters at most for city-scale data. A good rule of thumb: the maximum elevation (field max × elevationScale) should not exceed ~500m for typical zoom levels.
- Bind layers to datasets with _sqlroomsBinding.dataset and put tableName or sqlQuery sources in config.datasets.
- Each dataset in config.datasets should have a source.tableName or source.sqlQuery that describes the original table the map was authored against. At runtime, the dashboard's selected table (from the table selector) overrides the source table — when the user switches the active table, all map panels automatically update. If the new table lacks required columns, an incompatibility error is shown.
- IMPORTANT: Always pass tableName in the create_dashboard_map tool params (the top-level tableName field). Use the table currently selected in the dashboard (dashboard.selectedTable from list_dashboard_panels). At runtime, the dashboard's selected table always overrides the authored table — this param only seeds the initial selection when no table is selected yet.
- IMPORTANT: If you are creating a map layer for a table that is NOT the currently selected dashboard table, you MUST switch the dashboard's selected table to that dataset BEFORE or WHEN calling create_dashboard_map (pass the correct tableName). The map panel resolves data from the dashboard's active table — if you don't switch it, the layer will query the wrong table and fail.
- IMPORTANT: When referencing tables in tableName or sqlQuery, use ONLY the bare table name (e.g. "my_table") or schema-qualified name (e.g. "main.my_table"). NEVER include the database/catalog prefix (e.g. do NOT use "sqlrooms-cli.main.my_table") — the catalog does not exist in the query execution context.
- IMPORTANT: For point data with longitude/latitude columns, the dataset source MUST use a sqlQuery that creates a geometry column, for example: "SELECT *, ST_AsWKB(ST_Point(\\"Longitude\\", \\"Latitude\\")) AS \\"__sqlrooms_geom\\" FROM tableName WHERE \\"Longitude\\" IS NOT NULL AND \\"Latitude\\" IS NOT NULL". Set geometryColumn to the same name used in the AS clause (e.g. "__sqlrooms_geom") and geometryEncodingHint to "wkb".
- IMPORTANT: When providing fitToData, it MUST be a flat object (NOT nested by dataset ID). Include either longitudeColumn+latitudeColumn (for point data with separate coordinate columns) OR geometryColumn (for data with a WKB geometry column like GeoJSON). For H3 hexagon layers, just specify the dataset: "fitToData": {"dataset": "datasetId"} — the H3 column is auto-detected from the layer binding. For GeoJSON/spatial files with a "geom" column, use: "fitToData": {"dataset": "datasetId", "geometryColumn": "geom"}. For point data use: "fitToData": {"dataset": "datasetId", "longitudeColumn": "lon", "latitudeColumn": "lat"}. NEVER nest fitToData as {"datasetId": {...}} — always use a flat object with "dataset" as a string field.
- IMPORTANT: For GeoJSON or spatial files that already have a native geometry column (e.g. "geometry", "geom"), use the table directly with source.tableName (no sqlQuery needed), set the dataset's geometryColumn to "geom", set geometryEncodingHint to "wkb", and use fitToData with geometryColumn: {"dataset": "datasetId", "geometryColumn": "geom"}.
- IMPORTANT: When a GeoJSON file (.geojson) is loaded as a table, DuckDB uses ST_Read to produce a table with a WKB "geom" column and all feature properties as columns. Use source.tableName, set geometryColumn to "geom" and geometryEncodingHint to "wkb". Use "fitToData": {"dataset": "datasetId", "geometryColumn": "geom"} to zoom to the data extent.
- For data-driven color, use native Deck JSON accessors with {"@@function":"colorScale", "field":"...", "type":"sequential"|"diverging"|"quantize"|"quantile"|"categorical", "scheme":"...", "domain":"auto"} on color properties such as getFillColor, getLineColor, getColor, getSourceColor, or getTargetColor. Valid schemes: for "categorical" type use one of Accent, Dark2, Paired, Pastel1, Pastel2, Set1, Set2, Set3, Tableau10, Observable10, Category10. For "sequential" use Viridis, Inferno, Magma, Plasma, Turbo, Blues, Greens, Oranges, Reds, Purples, etc. For "diverging" use RdBu, Spectral, RdYlGn, BrBG, PiYG, etc. IMPORTANT: The colorScale "field" must reference a column that exists in the FINAL query output (after any GROUP BY aggregation). Do not reference columns that are lost during aggregation.
- Map panels default to a 100000-row runtime data limit; use config.dataPolicy.maxRows only when the map genuinely needs a panel-specific limit.
- Create maps with a SINGLE layer unless the user explicitly asks for multiple layers. If you think multiple layers would better serve the user's request, ask the user for confirmation before adding them.
- IMPORTANT: Browsers limit the number of active WebGL contexts (typically 8–16 per page). Each map panel uses one context. Do NOT create more than 4–5 map panels in a single dashboard — exceeding the limit causes older maps to lose their rendering context and show errors. If the user asks for many datasets, prefer combining compatible layers into fewer maps rather than creating one map per dataset.
- After calling create_dashboard_map, call list_dashboard_panels before your final response and check the map panel issue. If it has a render-error, repair the map config in place instead of saying the map is complete.
- BASEMAPS: Do NOT use Mapbox basemap styles (mapbox://styles/...) — they require a Mapbox access token which is not available. The map uses CARTO basemaps by default (positron for light, dark-matter for dark theme) which work without any token. If you need to set a custom mapStyle, use free tile providers like CARTO (https://basemaps.cartocdn.com/gl/...) or other token-free MapLibre-compatible style URLs.
`;

function createDeckMapDashboardExtraTools(
  extraTools?: ExtraDashboardAiToolsFactory,
) {
  return (params: ExtraDashboardAiToolsParams) => ({
    ...createDeckMapDashboardAiTools(params),
    ...(extraTools?.(params) ?? {}),
  });
}

/**
 * Returns AI instructions for dashboards with Deck.gl map support.
 * Provides guidance on when and how to use map visualizations.
 *
 * @returns Instructions string for AI agents
 */
export function getDashboardWithDeckMapAiInstructions() {
  return `${DECK_MAP_AI_INSTRUCTIONS.trim()}`;
}

/**
 * Creates dashboard AI tools with built-in Deck.gl map support.
 * Extends standard dashboard tools with map visualization capabilities.
 *
 * @param options - Dashboard AI tools configuration options
 * @returns Record mapping tool names to tool instances, including map tools
 */
export function createDashboardWithDeckMapAiTools(
  options: CreateDashboardAiToolsOptions,
): Record<string, Tool> {
  return createMosaicDashboardAiTools({
    ...options,
    extraTools: createDeckMapDashboardExtraTools(options.extraTools),
  });
}

/**
 * Creates a dashboard agent tool with built-in Deck.gl map support.
 * Extends the standard dashboard agent with map creation capabilities.
 *
 * @template TState - Store state type extending MosaicDashboardStoreState
 * @param options - Dashboard agent configuration options
 * @returns Dashboard agent tool with map support
 */
export function createDashboardAgentToolWithDeckMaps<
  TState extends MosaicDashboardStoreState,
>(options: CreateDashboardAgentToolOptions<TState>): Tool {
  return createDashboardAgentTool({
    ...options,
    additionalInstructions: [
      options.additionalInstructions,
      DECK_MAP_AI_INSTRUCTIONS.trim(),
    ]
      .filter(Boolean)
      .join('\n\n'),
    extraTools: createDeckMapDashboardExtraTools(options.extraTools),
  });
}

const DeckMapLayerBindingConfig = z.looseObject({
  dataset: z.string().optional(),
  geometryColumn: z.string().optional(),
  geometryEncodingHint: z.enum(['geoarrow', 'wkb', 'wkt']).optional(),
  sourceGeometryColumn: z.string().optional(),
  targetGeometryColumn: z.string().optional(),
  timestampColumn: z.string().optional(),
  hexagonColumn: z.string().optional(),
});

const DeckMapLayerSpec = z.looseObject({
  '@@type': z.string().optional(),
  id: z.string().optional(),
  _sqlroomsBinding: DeckMapLayerBindingConfig.optional(),
});

const DeckMapSpec = z.looseObject({
  initialViewState: z.record(z.string(), z.unknown()).optional(),
  viewState: z.record(z.string(), z.unknown()).optional(),
  controller: z.unknown().optional(),
  layers: z.array(DeckMapLayerSpec).optional(),
});

const DeckMapDatasetSource = z.looseObject({
  tableName: z.string().optional(),
  sqlQuery: z.string().optional(),
});

const DeckMapDatasetConfig = z.looseObject({
  source: DeckMapDatasetSource.optional(),
  geometryColumn: z.string().optional(),
  geometryEncodingHint: z.enum(['geoarrow', 'wkb', 'wkt']).optional(),
});

const DeckMapDataPolicyConfig = z.looseObject({
  disabled: z.boolean().optional(),
  maxRows: z.number().int().min(1).optional(),
  reason: z.string().optional(),
});

export const DeckMapDashboardConfigParameter = z.looseObject({
  spec: DeckMapSpec.describe(
    'Deck JSON map spec as an object. Use spec.layers[].@@type for layer classes such as GeoArrowScatterplotLayer (Point layer), GeoArrowHeatmapLayer, GeoArrowPolygonLayer, GeoArrowPathLayer, or GeoArrowArcLayer.',
  ),
  datasets: z
    .record(z.string(), DeckMapDatasetConfig)
    .describe(
      'Datasets keyed by dataset id. Layers bind to these ids through _sqlroomsBinding.dataset. Each dataset source may use tableName or sqlQuery.',
    ),
  mapStyle: z.string().optional(),
  mapProps: z.record(z.string(), z.unknown()).optional(),
  showLegends: z.boolean().optional(),
  interaction: z.record(z.string(), z.unknown()).optional(),
  fitToData: z.record(z.string(), z.unknown()).optional(),
  dataPolicy: DeckMapDataPolicyConfig.optional().describe(
    'Optional per-map runtime data policy. Maps default to 100000 rows; set maxRows for a panel-specific override or disabled=true to bypass row-count validation.',
  ),
  settingsOpen: z.boolean().optional(),
});

export type DeckMapDashboardConfigToolConfig = z.infer<
  typeof DeckMapDashboardConfigParameter
>;

export const DeckMapConfigToolParameters = z.object({
  title: z.string().optional().default('Map').describe('Map title.'),
  config: DeckMapDashboardConfigParameter.describe(
    'Native Deck JSON dashboard map config. This is the canonical map representation.',
  ),
  reasoning: z
    .string()
    .describe('Brief rationale for creating the map config.'),
});

export type DeckMapConfigToolParams = z.infer<
  typeof DeckMapConfigToolParameters
>;

export const DeckMapDashboardToolParameters =
  DeckMapConfigToolParameters.extend({
    tableName: z
      .string()
      .optional()
      .describe(
        'Optional table name used only to select/resolve the target dashboard table. Data sources still come from config.datasets.',
      ),
    panelId: z
      .string()
      .optional()
      .describe(
        'Optional panel ID. If provided, updates the existing map panel instead of creating a new one.',
      ),
    reasoning: z
      .string()
      .describe('Brief rationale for creating the map panel.'),
  });

export type DeckMapDashboardToolParams = z.infer<
  typeof DeckMapDashboardToolParameters
>;

const DEFAULT_AI_GEOMETRY_COLUMN = '__sqlrooms_geom';

/**
 * Normalizes an AI-generated map config to ensure dataset sources produce
 * the expected geometry column when fitToData specifies coordinate columns
 * but the dataset only uses a tableName without a sqlQuery.
 */
function normalizeAiMapConfig(
  config: DeckMapDashboardConfigToolConfig,
): DeckMapDashboardConfigToolConfig {
  const datasets = config.datasets;
  let fitToData = config.fitToData as
    | Record<string, unknown>
    | null
    | undefined;

  // Fix common AI mistake: fitToData wrapped as { datasetId: { dataset, ... } }
  // instead of the expected flat { dataset, longitudeColumn, ... }.
  if (fitToData && !fitToData.dataset && typeof fitToData === 'object') {
    const keys = Object.keys(fitToData);
    if (keys.length === 1) {
      const nested = fitToData[keys[0]!] as Record<string, unknown> | undefined;
      if (nested && typeof nested === 'object' && nested.dataset) {
        fitToData = nested;
        config = {...config, fitToData: fitToData as any};
      }
    }
  }

  if (!datasets || typeof datasets !== 'object' || !fitToData) {
    return config;
  }

  const lonCol = fitToData.longitudeColumn as string | undefined;
  const latCol = fitToData.latitudeColumn as string | undefined;
  if (!lonCol || !latCol) {
    return config;
  }

  const targetDatasetId = fitToData.dataset as string | undefined;
  if (!targetDatasetId) {
    return config;
  }

  const targetDataset = datasets[targetDatasetId] as
    | Record<string, unknown>
    | undefined;
  if (!targetDataset) {
    return config;
  }

  const source = targetDataset.source as
    | {tableName?: string; sqlQuery?: string}
    | undefined;

  // Always normalize when using tableName without sqlQuery and fitToData
  // provides coordinate columns — the geometry must be computed from them.
  if (!source?.tableName || source.sqlQuery) {
    return config;
  }

  const geometryColumn =
    (targetDataset.geometryColumn as string | undefined) ||
    DEFAULT_AI_GEOMETRY_COLUMN;

  const quotedLon = quoteDeckMapSqlIdentifier(lonCol);
  const quotedLat = quoteDeckMapSqlIdentifier(latCol);
  const quotedGeom = quoteDeckMapSqlIdentifier(geometryColumn);
  const tableParts = splitIdentifierPathOutsideQuotes(source.tableName)
    .map((p) =>
      p.startsWith('"') && p.endsWith('"') ? p : quoteDeckMapSqlIdentifier(p),
    )
    .join('.');
  const sqlQuery = [
    `SELECT *, ST_AsWKB(ST_Point(${quotedLon}, ${quotedLat})) AS ${quotedGeom}`,
    `FROM ${tableParts}`,
    `WHERE ${quotedLon} IS NOT NULL AND ${quotedLat} IS NOT NULL`,
  ].join(' ');

  return {
    ...config,
    datasets: {
      ...datasets,
      [targetDatasetId]: {
        ...targetDataset,
        source: {sqlQuery},
        geometryColumn,
        geometryEncodingHint: 'wkb',
      },
    },
  };
}

function cloneConfig(
  config: DeckMapDashboardConfigToolConfig,
): DeckMapDashboardPanelConfig {
  const normalized = normalizeAiMapConfig(config);
  return JSON.parse(JSON.stringify(normalized)) as DeckMapDashboardPanelConfig;
}

function createDeckMapPanelFromNativeConfig(
  params: Pick<DeckMapConfigToolParams, 'title' | 'config'>,
) {
  return createDeckMapDashboardPanelConfig({
    title: params.title || 'Map',
    ...cloneConfig(params.config),
  });
}

function getFirstDatasetSourceTableName(
  config: DeckMapDashboardConfigToolConfig,
): string | undefined {
  if (!config.datasets || typeof config.datasets !== 'object') {
    return undefined;
  }

  return Object.values(config.datasets)
    .map(
      (dataset) =>
        (dataset as Record<string, unknown>).source as
          | {tableName?: string}
          | undefined,
    )
    .find((source) => source?.tableName)?.tableName;
}

export function createDeckMapConfigTool(): Tool {
  return tool({
    description: `Deck map config: validates and returns a reusable native Deck JSON map configuration without requiring a dashboard artifact.

Use when: a chat, agent, or artifact outside a dashboard needs a geospatial map config. Author the map using native Deck JSON: put layer classes in spec.layers[].@@type, bind layers to datasets through _sqlroomsBinding.dataset, and put tableName or sqlQuery sources in config.datasets. For data-driven colors, use color accessors such as getFillColor, getLineColor, getColor, getSourceColor, or getTargetColor with {"@@function":"colorScale", "field":"...", "type":"...", "scheme":"...", "domain":"auto"}. For categorical fields use scheme from: Tableau10, Set2, Category10, etc. For numeric fields use sequential schemes like Viridis.`,
    inputSchema: DeckMapConfigToolParameters,
    execute: async (params) => {
      try {
        const panel = createDeckMapPanelFromNativeConfig(params);
        return {
          llmResult: {
            success: true,
            details: `Created deck map config "${panel.title}".`,
            data: {
              kind: 'deck-map-config',
              title: panel.title,
              type: DECK_MAP_DASHBOARD_PANEL_TYPE,
              config: panel.config,
            },
          },
        };
      } catch (error) {
        return {
          llmResult: {
            success: false,
            errorMessage:
              error instanceof Error ? error.message : String(error),
          },
        };
      }
    },
  });
}

/**
 * Creates AI tools for Deck.gl map configuration.
 * Returns tools for creating and configuring Deck.gl map panels.
 *
 * @returns Record mapping tool names to map configuration tools
 */
export function createDeckMapAiTools(): Record<string, Tool> {
  return {
    create_deck_map_config: createDeckMapConfigTool(),
  };
}

/**
 * Parameters for creating a Deck.gl map dashboard tool.
 * Provides adapters for dashboard and database operations.
 */
export type CreateDeckMapDashboardToolParams = {
  /** Dashboard adapter for adding and updating map panels */
  dashboardAdapter: DashboardAiAdapter;
  /** Database adapter for table validation */
  databaseAdapter: DatabaseAiAdapter;
};

/**
 * Creates a tool for adding Deck.gl map panels to dashboards.
 * Supports creating new map panels or updating existing ones with native Deck JSON configs.
 *
 * @param params - Parameters containing dashboard and database adapters
 * @returns Tool instance for creating/updating Deck.gl map panels
 */
export function createDeckMapDashboardTool({
  dashboardAdapter,
  databaseAdapter,
}: CreateDeckMapDashboardToolParams): Tool {
  return tool({
    description: `Deck map panel: creates or updates an interactive geospatial map panel in a Mosaic dashboard from a native Deck JSON config.

Use when: the user asks for a map in a dashboard. Author the map using native Deck JSON: choose layer classes with spec.layers[].@@type, bind layers to datasets through _sqlroomsBinding.dataset, and put tableName or sqlQuery sources in config.datasets. For data-driven colors, use color accessors such as getFillColor, getLineColor, getColor, getSourceColor, or getTargetColor with {"@@function":"colorScale", "field":"...", "type":"...", "scheme":"...", "domain":"auto"}. For categorical fields use scheme from: Tableau10, Set2, Category10, etc. For numeric fields use sequential schemes like Viridis.`,
    inputSchema: DeckMapDashboardToolParameters,
    execute: async (params) => {
      try {
        const tableName =
          params.tableName ?? getFirstDatasetSourceTableName(params.config);

        if (tableName) {
          ensureTable(databaseAdapter, tableName);
          dashboardAdapter.setSelectedTable(tableName);
        }

        const panel = createDeckMapPanelFromNativeConfig(params);

        if (params.panelId) {
          ensurePanel(
            dashboardAdapter,
            params.panelId,
            DECK_MAP_DASHBOARD_PANEL_TYPE,
          );

          dashboardAdapter.updatePanel(params.panelId, {
            title: panel.title,
            config: panel.config,
          });

          return {
            llmResult: {
              success: true,
              details: `Updated map panel "${panel.title}".`,
              data: {
                panelId: params.panelId,
                title: panel.title,
                type: DECK_MAP_DASHBOARD_PANEL_TYPE,
                config: panel.config,
              },
            },
          };
        }

        const panelId = dashboardAdapter.addPanel(panel);

        return {
          llmResult: {
            success: true,
            details: `Created map panel "${panel.title}".`,
            data: {
              panelId,
              title: panel.title,
              type: DECK_MAP_DASHBOARD_PANEL_TYPE,
              config: panel.config,
            },
          },
        };
      } catch (error) {
        return {
          llmResult: {
            success: false,
            errorMessage:
              error instanceof Error ? error.message : String(error),
          },
        };
      }
    },
  });
}

export function createDeckMapDashboardAiTools(
  params: CreateDeckMapDashboardToolParams,
): Record<string, Tool> {
  return {
    [MAP_TOOL_KEY]: createDeckMapDashboardTool(params),
  };
}
