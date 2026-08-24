import {tool, type Tool} from 'ai';
import {z} from 'zod';
import {formatColorSchemePromptLists} from '@sqlrooms/color-scales/colorSchemeNames';
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
import {DECK_TABLE_DATASET_SOURCE_RELATION} from './datasets/tableDatasetSql';
import {
  getFirstDatasetSourceTableName,
  hasSqlOnlyDatasetSource,
} from './datasetSourceUtils';
import {getDeckMapSharedAiContractRules} from './mapAiSharedInstructions';
import {prepareAiDeckMapConfig} from './aiNormalize';
import type {PrepareAiDeckMapConfigOptions} from './aiNormalize';
import {assertDeckMapResourceConfig} from './mapResourceAuthoring';
import type {DeckMapConfig} from './mapConfig';

export {getFirstDatasetSourceTableName, hasSqlOnlyDatasetSource};

const COLOR_SCHEME_PROMPT_LISTS = formatColorSchemePromptLists();

export const DECK_MAP_AI_INSTRUCTIONS = `
Deck map tools:
- create_deck_map_config validates and returns a reusable native Deck JSON map config without requiring a dashboard artifact.
- create_dashboard_map creates or updates an interactive map panel inside a dashboard from a native Deck JSON map config.
- Use map tools when the user asks for a map, geospatial/spatial visualization, locations, longitude/latitude data, or geometry columns.
- CONFIG MODE: Every map config must include a configMode field ("basic" or "custom") that determines how the map was authored and whether the UI settings panel is available.
  - "basic" (default): Use for straightforward requests — single layer, standard color scale, simple geometry binding. Stick ONLY to properties that the UI configurator supports: layer @@type, visibility, color scale (@@function colorScale), point radius (numeric getRadius with radiusUnits), line width (numeric getWidth with widthUnits), geometry/H3/arc column bindings, extrusion with a single elevation column ("@@=columnName" or {"@@function":"scale","field":"...","type":"linear","domain":"auto","range":[0,200]}). Do NOT use free-form string expressions (e.g. "floors * 3"), custom extensions, multiple layers, or advanced deck.gl props in basic mode. The user can fine-tune these maps through the settings panel.
  - "custom": Use when the request demands creative, complex, or advanced visualization — multiple layers, free-form data-driven accessors, custom color arrays, advanced deck.gl props (opacity, transitions, material, highlightColor, etc.), layer extensions, or any props not representable in the UI configurator. The UI settings panel will be disabled for custom configs; users edit via the JSON editor instead.
  - Decision rule: If the map can be fully expressed with a single layer + basic color scale + simple numeric radius/width (+ optional single elevation column), use "basic". Extruded GeoArrowColumnLayer / polygon maps with one elevation field must stay "basic" so the settings panel remains available. Use "custom" only when basic cannot express the request.
- Author maps with config.spec.layers using Deck JSON layer classes in @@type, such as GeoArrowScatterplotLayer, GeoArrowHeatmapLayer, GeoArrowPolygonLayer, GeoArrowPathLayer, GeoArrowTripsLayer, GeoArrowArcLayer, GeoArrowH3HexagonLayer, or GeoJsonLayer. Always use the full GeoArrow-prefixed class name when choosing a GeoArrow layer (e.g. "GeoArrowScatterplotLayer", not "ScatterplotLayer") — unprefixed names are not registered. Prefer a typed GeoArrow* layer when the geometry type is known; use GeoJsonLayer for mixed or generic GeoJSON/WKB feature rendering with _sqlroomsBinding.
${getDeckMapSharedAiContractRules()}
- LAYER SELECTION: Choose the layer type based on the geometry type in the data.
  IMPORTANT: Only create a layer if the table contains data suitable for that layer type, or if you can transform the data into the required format with transformSql or a standalone sqlQuery. Do NOT create a layer if the data is clearly incompatible (e.g. do not create a path layer from point-only data without aggregation, do not create a polygon layer from point coordinates, do not create an arc layer without origin-destination pairs).
  - Point data (lon/lat coordinates, point geometry): GeoArrowScatterplotLayer (Point layer), GeoArrowHeatmapLayer, GeoArrowColumnLayer. Requires lon/lat columns (via ST_Point transformSql) or a Point geometry column — follow the shared Point-position rules above.
  - Polygon data (building footprints, boundaries, areas, parcels, zones): GeoArrowPolygonLayer for uniform Polygon columns. Use GeoJsonLayer for WKB/WKT MultiPolygon columns so separate polygon parts retain their nesting.
  - Line data (roads, routes, paths, rivers): GeoArrowPathLayer. Requires LineString geometry (or a single-part MultiLineString). Multi-part MultiLineString cannot be rendered as one path — explode/merge with ST_Dump / ST_LineMerge first. If the table has one row per waypoint (path_id/route_id + order/sequence + lat/lon), aggregate with transformSql: "SELECT path_id, label, ST_AsWKB(ST_MakeLine(LIST(ST_Point(lon, lat) ORDER BY waypoint_order))) AS geom FROM ${DECK_TABLE_DATASET_SOURCE_RELATION} GROUP BY path_id, label". Set geometryColumn to "geom" and geometryEncodingHint to "wkb". If linestring geom already exists, use it directly (or SELECT * EXCLUDE (geom), ST_AsWKB(geom) AS geom ... WHERE ST_GeometryType(geom) = 'LINESTRING').
  - Animated trip data (routes with timestamps): GeoArrowTripsLayer (see shared trips-vs-arc rule). One row per trip: LineString geom + timestamps list (same order/length as vertices).
    (1) Waypoint rows (trip_id/path_id + lat/lon + order/time): GROUP BY trip id. Example: "SELECT trip_id, ANY_VALUE(label) AS label, ST_AsWKB(ST_MakeLine(LIST(ST_Point(lon, lat) ORDER BY waypoint_order))) AS geom, LIST(timestamp ORDER BY waypoint_order) AS timestamps FROM ${DECK_TABLE_DATASET_SOURCE_RELATION} GROUP BY trip_id". Keep attrs with ANY_VALUE(col). Use ST_MakeLine(LIST(...)) only — never ST_MakeLine(ST_Point(...) ORDER BY ...); always GROUP BY the trip id.
    (2) OD pairs already one row per trip: no GROUP BY — "SELECT trip_id, ST_AsWKB(ST_MakeLine([ST_Point(pickup_lon, pickup_lat), ST_Point(dropoff_lon, dropoff_lat)])) AS geom, [0.0, 1.0] AS timestamps FROM ${DECK_TABLE_DATASET_SOURCE_RELATION}" (prefer [0.0, duration] when available).
    In both cases set geometryColumn to "geom", geometryEncodingHint to "wkb", and _sqlroomsBinding.timestampColumn to "timestamps".
  - Arc data (origin-destination pairs): GeoArrowArcLayer for arcs/connections/flows/OD links only (see shared arc-binding rule). Example transformSql: "SELECT *, ST_AsWKB(ST_Point(source_lon, source_lat)) AS source_geom, ST_AsWKB(ST_Point(target_lon, target_lat)) AS target_geom FROM ${DECK_TABLE_DATASET_SOURCE_RELATION}". Flat lines: "getHeight": 0. For H3 OD pairs use h3_cell_to_lng/lat inside ST_Point (not h3_latlng).
  - H3 hexagon data: GeoArrowH3HexagonLayer (see shared H3 rule). Include fitToData {"dataset":"datasetId"}. Valid H3 helpers: h3_cell_to_lat/lng/latlng — not h3_latlng/h3_to_lat.
- CRITICAL geometryColumn rule: The geometryColumn field (in datasets[id].geometryColumn, _sqlroomsBinding.geometryColumn, and fitToData.geometryColumn) MUST match the exact column alias that produces the WKB geometry in the final query output — typically the "AS geom" alias in ST_AsWKB(...) AS geom. It must NEVER be set to a GROUP BY key, an ID column, or any other non-geometry column. For example, if the transformSql is "SELECT path_id, ST_AsWKB(ST_MakeLine(...)) AS geom ... GROUP BY path_id", geometryColumn must be "geom" (the geometry output), NOT "path_id" (the grouping key). Setting geometryColumn to a non-geometry column will cause the layer to fail silently.
- CRITICAL: The transformSql and sqlQuery fields must contain ONLY a single SELECT statement. NEVER put INSTALL, LOAD, CREATE, or other DDL/meta-commands in dataset SQL — they will fail because dataset SQL is wrapped in a subquery at runtime. Extensions like h3 and spatial are pre-loaded at startup.
  - GeoJSON files typically contain polygon or multipolygon features; use polygon layers (or follow shared Point/mixed rules when the user asks for points/mixed rendering).
- RADIUS AND WIDTH: For GeoArrowScatterplotLayer (Point layer) use numeric getRadius with radiusUnits: "pixels" (typically 2–6). Never use string expressions like "field * 500" in basic mode — they bypass pixel clamping. Data-driven size: "@@=columnName" only in configMode "custom", with radiusUnits meters so radiusMaxPixels can cap. For GeoArrowColumnLayer use "radius" in meters (not getRadius/radiusUnits), typically 20–200. Always set "extruded": true when using getElevation. For Arc/Path/Trips use numeric getWidth with widthUnits: "pixels" (typically 1–3).
- ARC vs LINE: GeoArrowArcLayer renders curved 3D arcs by default. If the user asks for "lines" or "straight connections" between origin-destination pairs (not arcs), set "getHeight": 0 on the layer to render flat straight lines. Use arcs for flight routes or connections where the curve adds clarity; use flat lines for direct relationships, edges, or when the user explicitly requests lines.
- ELEVATION: For extruded layers set "extruded": true. Prefer getElevation {"@@function":"scale","field":"...","type":"linear","domain":"auto","range":[0,200]} (basic-mode friendly) or "@@=columnName". elevationScale multiplies raw field meters — keep max visual height moderate (~hundreds of meters). Do NOT use negative elevation. For polygon building footprints with GeoArrowColumnLayer, transformSql should produce points via the shared centroid rule. CRITICAL: Extruded ColumnLayer / polygon maps need a pitched camera — set spec.initialViewState with pitch around 45–60 (and optional bearing). Top-down pitch 0 makes columns look like flat disks and appear "missing".
- Bind layers to datasets with _sqlroomsBinding.dataset and put tableName, tableName+transformSql, or sqlQuery sources in config.datasets.
- Use source.tableName for direct table-backed datasets. Use source.tableName plus source.transformSql when the map needs generated geometry or aggregation but should still follow the dashboard selected table. transformSql must read from ${DECK_TABLE_DATASET_SOURCE_RELATION}, not from the authored table name.
- Use source.sqlQuery only for a standalone literal query that should remain pinned to the authored SQL. Dashboard selected table replacement applies only to structured tableName sources, not literal sqlQuery sources.
- IMPORTANT: Always pass tableName in the create_dashboard_map tool params (the top-level tableName field). Use the table currently selected in the dashboard (dashboard.selectedTable from list_dashboard_panels). At runtime, the dashboard's selected table overrides structured source.tableName values — this param seeds or changes that selection.
- IMPORTANT: If you are creating a structured table-backed map layer for a table that is NOT the currently selected dashboard table, you MUST switch the dashboard's selected table to that dataset BEFORE or WHEN calling create_dashboard_map (pass the correct tableName). Structured table-backed map panels resolve data from the dashboard's active table — if you don't switch it, the layer will query the wrong table and fail.
- IMPORTANT: When referencing tables in tableName or sqlQuery, use ONLY the bare table name (e.g. "my_table") or schema-qualified name (e.g. "main.my_table"). NEVER include the database/catalog prefix (e.g. do NOT use "sqlrooms-cli.main.my_table") — the catalog does not exist in the query execution context.
- IMPORTANT: For point data with longitude/latitude columns that should follow dashboard table switching, use source.tableName plus source.transformSql to create a geometry column, for example: "SELECT *, ST_AsWKB(ST_Point(\\"Longitude\\", \\"Latitude\\")) AS \\"__sqlrooms_geom\\" FROM ${DECK_TABLE_DATASET_SOURCE_RELATION} WHERE \\"Longitude\\" IS NOT NULL AND \\"Latitude\\" IS NOT NULL". Set geometryColumn to the same name used in the AS clause (e.g. "__sqlrooms_geom") and geometryEncodingHint to "wkb".
- IMPORTANT: When providing fitToData, it MUST be a flat object (NOT nested by dataset ID). Include either longitudeColumn+latitudeColumn (for point data with separate coordinate columns) OR geometryColumn (for data with a WKB geometry column like GeoJSON). For H3 hexagon layers, just specify the dataset: "fitToData": {"dataset": "datasetId"} — the H3 column is auto-detected from the layer binding. For GeoJSON/spatial files with a "geom" column, use: "fitToData": {"dataset": "datasetId", "geometryColumn": "geom"}. For point data use: "fitToData": {"dataset": "datasetId", "longitudeColumn": "lon", "latitudeColumn": "lat"}. NEVER nest fitToData as {"datasetId": {...}} — always use a flat object with "dataset" as a string field.
- IMPORTANT: For GeoJSON or spatial files that already have a native geometry column (e.g. "geometry", "geom"), use the table directly with source.tableName (no sqlQuery needed), set the dataset's geometryColumn to "geom", set geometryEncodingHint to "wkb", and use fitToData with geometryColumn: {"dataset": "datasetId", "geometryColumn": "geom"}.
- IMPORTANT: When a GeoJSON file (.geojson) is loaded as a table, DuckDB uses ST_Read to produce a table with a WKB "geom" column and all feature properties as columns. Use source.tableName, set geometryColumn to "geom" and geometryEncodingHint to "wkb". Use "fitToData": {"dataset": "datasetId", "geometryColumn": "geom"} to zoom to the data extent.
- For data-driven color, use {"@@function":"colorScale", "field":"...", "type":"sequential"|"diverging"|"quantize"|"quantile"|"categorical", "scheme":"...", "domain":"auto"} on getFillColor / getLineColor / getColor / getSourceColor / getTargetColor. Key is "@@function" (not "@@type"); column goes in "field" (not "column"). Exact scheme names: ${COLOR_SCHEME_PROMPT_LISTS}. "field" must exist in the FINAL query output after any GROUP BY.
- COLOR SCALE PREFERENCE: Prefer colorScale over flat fill when a useful varying column exists — numeric → sequential/quantile (quantile if skewed); categorical/string → categorical. A numeric column is useful only when min < max (not all zeros / constant); otherwise use flat fill. If the user explicitly names a column for color, honor that even when flat. Flat fill also when the user asks for one color. "field" must be the exact schema column name (case-sensitive; "Magnitude" not "mag"). IMPORTANT: Viridis/Plasma/Inferno/Turbo/Cividis/Magma require type "sequential" (not quantile/quantize). Quantile/quantize schemes must be ColorBrewer ramps such as YlOrRd, Blues, Greens, RdYlBu.
- IMPORTANT: Enabling a color scale means adding a {"@@function":"colorScale", ...} accessor to a compatible layer color property. The top-level showLegends field only controls whether already-defined color scale legends are visible; showLegends by itself does NOT create or enable data-driven color.
- Map panels default to a 100000-row runtime data limit; use config.dataPolicy.maxRows only when the map genuinely needs a panel-specific limit.
- Create maps with a SINGLE layer unless the user explicitly asks for multiple layers. If you think multiple layers would better serve the user's request, ask the user for confirmation before adding them.
- IMPORTANT: Browsers limit the number of active WebGL contexts (typically 8–16 per page). Each map panel uses one context. Do NOT create more than 4–5 map panels in a single dashboard — exceeding the limit causes older maps to lose their rendering context and show errors. If the user asks for many datasets, prefer combining compatible layers into fewer maps rather than creating one map per dataset.
- After calling create_dashboard_map, call list_dashboard_panels before your final response and check the map panel issue. If it has a render-error, repair the map config in place instead of saying the map is complete.
- IMPORTANT: Dashboard map tools replace the full panel config — always include datasets and layers on updates. Omitting datasets is only valid for document sparse patches that merge with durable state.
- SWITCHING LAYER TYPE: On type switch/replace, send only the new layer (replaceLayers: true for merge patches; full desired layers list for dashboard updates). Do not leave the old layer as visible: false.
`;

function createDeckMapDashboardExtraTools(
  extraTools?: ExtraDashboardAiToolsFactory,
  prepareOptions?: Pick<PrepareAiDeckMapConfigOptions, 'stripCatalogNames'>,
) {
  return (params: ExtraDashboardAiToolsParams) => ({
    ...createDeckMapDashboardAiTools({
      ...params,
      stripCatalogNames: prepareOptions?.stripCatalogNames,
    }),
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
export type CreateDashboardWithDeckMapAiToolsOptions =
  CreateDashboardAiToolsOptions & {
    /** Host-injected catalogs to strip; omit for none — deck does not hardcode any. */
    stripCatalogNames?: readonly string[];
  };

export function createDashboardWithDeckMapAiTools(
  options: CreateDashboardWithDeckMapAiToolsOptions,
): Record<string, Tool> {
  const {stripCatalogNames, extraTools, ...rest} = options;
  return createMosaicDashboardAiTools({
    ...rest,
    extraTools: createDeckMapDashboardExtraTools(extraTools, {
      stripCatalogNames,
    }),
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
export type CreateDashboardAgentToolWithDeckMapsOptions<
  TState extends MosaicDashboardStoreState,
> = CreateDashboardAgentToolOptions<TState> & {
  stripCatalogNames?: readonly string[];
};

export function createDashboardAgentToolWithDeckMaps<
  TState extends MosaicDashboardStoreState,
>(options: CreateDashboardAgentToolWithDeckMapsOptions<TState>): Tool {
  const {stripCatalogNames, extraTools, ...rest} = options;
  return createDashboardAgentTool({
    ...rest,
    additionalInstructions: [
      options.additionalInstructions,
      DECK_MAP_AI_INSTRUCTIONS.trim(),
    ]
      .filter(Boolean)
      .join('\n\n'),
    extraTools: createDeckMapDashboardExtraTools(extraTools, {
      stripCatalogNames,
    }),
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
  transformSql: z.string().optional(),
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
      'Datasets keyed by dataset id. Layers bind to these ids through _sqlroomsBinding.dataset. Each dataset source may use tableName, tableName+transformSql, or sqlQuery.',
    ),
  configMode: z
    .enum(['basic', 'custom'])
    .optional()
    .describe(
      'Config authoring mode. Use "basic" (default) for straightforward single-layer maps that the user can tweak via the UI settings panel. Use "custom" for complex, multi-layer, or creative maps that use advanced deck.gl props beyond what the UI configurator supports — the settings panel will be disabled for custom configs.',
    ),
  mapStyle: z.string().optional(),
  mapProps: z.record(z.string(), z.unknown()).optional(),
  showLegends: z
    .boolean()
    .optional()
    .describe(
      'Whether to show color scale legends on the map. Defaults to true; omit or set true unless the user explicitly asks to hide legends.',
    ),
  interaction: z.record(z.string(), z.unknown()).optional(),
  fitToData: z
    .object({
      dataset: z.string().describe('Dataset id to compute bounds from.'),
      longitudeColumn: z
        .string()
        .optional()
        .describe('Longitude column name for point data.'),
      latitudeColumn: z
        .string()
        .optional()
        .describe('Latitude column name for point data.'),
      geometryColumn: z
        .string()
        .optional()
        .describe('WKB geometry column name for computing bounds.'),
      geometryColumns: z
        .array(z.string())
        .optional()
        .describe(
          'Multiple WKB geometry columns whose extents are combined (e.g. arc source + target). Prefer omitting this — for GeoArrowArcLayer it is inferred from _sqlroomsBinding.',
        ),
      h3Column: z
        .string()
        .optional()
        .describe('H3 hex index column for computing bounds.'),
      padding: z.number().optional(),
      maxZoom: z.number().optional(),
    })
    .optional()
    .describe(
      'Fit map view to data bounds. Provide dataset plus either geometryColumn (for WKB geometry) or longitudeColumn+latitudeColumn (for separate coordinate columns). For arc layers, just {"dataset": "datasetId"} is enough — source and target geometry columns are inferred from the layer binding. Example: {"dataset": "myDataset", "geometryColumn": "geom"}',
    ),
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

export {
  normalizeAiDeckMapConfig,
  prepareAiDeckMapConfig,
  validateAndFixColorScaleFields,
} from './aiNormalize';

function cloneConfig(
  config: DeckMapDashboardConfigToolConfig,
  options?: PrepareAiDeckMapConfigOptions,
): DeckMapDashboardPanelConfig {
  const normalized = prepareAiDeckMapConfig(config, options);
  return JSON.parse(JSON.stringify(normalized)) as DeckMapDashboardPanelConfig;
}

/**
 * Creates a dashboard-compatible Deck map panel from the native map config
 * used by AI tools and embeddable map surfaces.
 */
export function createDeckMapPanelFromNativeConfig(
  params: Pick<DeckMapConfigToolParams, 'title' | 'config'>,
  options?: PrepareAiDeckMapConfigOptions,
) {
  const config = cloneConfig(params.config, options);
  assertDeckMapResourceConfig(config as DeckMapConfig);
  return createDeckMapDashboardPanelConfig({
    title: params.title || 'Map',
    ...config,
  });
}

export function createDeckMapConfigTool(): Tool {
  return tool({
    description: `Deck map config: validates and returns a reusable native Deck JSON map configuration without requiring a dashboard artifact.

Use when: a chat, agent, or artifact outside a dashboard needs a geospatial map config. Author the map using native Deck JSON: put layer classes in spec.layers[].@@type, bind layers to datasets through _sqlroomsBinding.dataset, and put tableName, tableName+transformSql, or sqlQuery sources in config.datasets. For data-driven colors, use color accessors such as getFillColor, getLineColor, getColor, getSourceColor, or getTargetColor with {"@@function":"colorScale", "field":"...", "type":"...", "scheme":"...", "domain":"auto"}. For categorical fields use scheme from: Tableau10, Set2, Category10, etc. For numeric fields use sequential schemes like Viridis.`,
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
  /** Host-injected catalogs to strip; omit for none — deck does not hardcode any. */
  stripCatalogNames?: readonly string[];
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
  stripCatalogNames,
}: CreateDeckMapDashboardToolParams): Tool {
  return tool({
    description: `Deck map panel: creates or updates an interactive geospatial map panel in a Mosaic dashboard from a native Deck JSON config.

Use when: the user asks for a map in a dashboard. Author the map using native Deck JSON: choose layer classes with spec.layers[].@@type, bind layers to datasets through _sqlroomsBinding.dataset, and put tableName, tableName+transformSql, or sqlQuery sources in config.datasets. For data-driven colors, use color accessors such as getFillColor, getLineColor, getColor, getSourceColor, or getTargetColor with {"@@function":"colorScale", "field":"...", "type":"...", "scheme":"...", "domain":"auto"}. For categorical fields use scheme from: Tableau10, Set2, Category10, etc. For numeric fields use sequential schemes like Viridis.`,
    inputSchema: DeckMapDashboardToolParameters,
    execute: async (params) => {
      try {
        // Prepare/validate before mutating dashboard selection so a rejected
        // config does not switch the active table as a side effect.
        const panel = createDeckMapPanelFromNativeConfig(params, {
          resolveTable: (name) => databaseAdapter.findTable(name),
          stripCatalogNames,
        });
        const tableName =
          params.tableName ?? getFirstDatasetSourceTableName(panel.config);

        if (tableName) {
          ensureTable(databaseAdapter, tableName);
        }

        if (tableName) {
          await dashboardAdapter.setSelectedTable(tableName);
        }
        if (params.panelId) {
          ensurePanel(
            dashboardAdapter,
            params.panelId,
            DECK_MAP_DASHBOARD_PANEL_TYPE,
          );

          await dashboardAdapter.updatePanel(params.panelId, {
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

        const panelId = await dashboardAdapter.addPanel(panel);

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
