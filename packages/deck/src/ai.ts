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
import {DECK_TABLE_DATASET_SOURCE_RELATION} from './datasets/tableDatasetSql';
import {
  getFirstDatasetSourceTableName,
  hasSqlOnlyDatasetSource,
} from './datasetSourceUtils';
import {getDeckMapSharedAiContractRules} from './mapAiSharedInstructions';
import {prepareAiDeckMapConfig} from './aiNormalize';
import type {PrepareAiDeckMapConfigOptions} from './aiNormalize';
import {assertDeckMapResourceConfig} from './mapResourceAuthoring';
import {asDeckJsonMapConfig, withPreservedDeckMapStyle} from './mapConfig';

export {getFirstDatasetSourceTableName, hasSqlOnlyDatasetSource};

/**
 * Authoring summary shared by both map tool descriptions, so hosts that
 * register a map tool without the full instructions still get the contract.
 */
const DECK_MAP_TOOL_AUTHORING_SUMMARY = `Author the map using native Deck JSON: put layer classes in spec.layers[].@@type, bind layers to datasets through _sqlroomsBinding.dataset, and put tableName, tableName+transformSql, or sqlQuery sources in config.datasets. For data-driven colors, use color accessors such as getFillColor, getLineColor, getColor, getSourceColor, or getTargetColor with {"@@function":"colorScale", "field":"...", "type":"...", "scheme":"...", "domain":"auto"}. For categorical fields use a scheme such as Tableau10, Set2, or Category10. For numeric fields use a sequential scheme such as Viridis.`;

export const DECK_MAP_AI_INSTRUCTIONS = `
Deck map tools:
- create_deck_map_config validates and returns a reusable native Deck JSON map config without requiring a dashboard artifact.
- create_dashboard_map creates or updates an interactive map panel inside a dashboard from a native Deck JSON map config.
- Use map tools when the user asks for a map, geospatial/spatial visualization, locations, longitude/latitude data, or geometry columns.

${getDeckMapSharedAiContractRules()}

Dashboard map panel rules (in addition to the shared rules above):
- Always pass the top-level tableName param to create_dashboard_map. At runtime the dashboard's selected table overrides structured source.tableName values, and this param seeds or changes that selection. When the map targets a table other than dashboard.selectedTable (from list_dashboard_panels), passing the correct tableName is mandatory — otherwise the layer queries the wrong table and fails. Selected-table replacement applies only to structured tableName sources, never to literal sqlQuery sources.
- IMPORTANT: When referencing tables in tableName or sqlQuery, use ONLY the bare table name (e.g. "my_table") or schema-qualified name (e.g. "main.my_table"). NEVER include the database/catalog prefix (e.g. do NOT use "sqlrooms-cli.main.my_table") — the catalog does not exist in the query execution context.
- For point data with longitude/latitude columns that should follow dashboard table switching, use source.tableName plus source.transformSql to create the geometry column, for example: "SELECT *, ST_AsWKB(ST_Point(\\"Longitude\\", \\"Latitude\\")) AS \\"__sqlrooms_geom\\" FROM ${DECK_TABLE_DATASET_SOURCE_RELATION} WHERE \\"Longitude\\" IS NOT NULL AND \\"Latitude\\" IS NOT NULL". Set geometryColumn to the alias used in the AS clause and geometryEncodingHint to "wkb".
- Dashboard map tools replace the full panel config — always include datasets and layers on updates, and send the complete desired layers list when switching layer type. Sparse patches that omit datasets are a document-surface feature only.
- Browsers limit active WebGL contexts (typically 8–16 per page) and each map panel uses one. Do NOT create more than 4–5 map panels in a single dashboard — exceeding the limit makes older maps lose their rendering context and show errors. For many datasets, prefer combining compatible layers into fewer maps over one map per dataset.
- After calling create_dashboard_map, call list_dashboard_panels before your final response and check the map panel issue. If it has a render-error, repair the map config in place instead of saying the map is complete.
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
  longitudeColumn: z.string().optional(),
  latitudeColumn: z.string().optional(),
  sourceGeometryColumn: z.string().optional(),
  targetGeometryColumn: z.string().optional(),
  sourceLongitudeColumn: z.string().optional(),
  sourceLatitudeColumn: z.string().optional(),
  targetLongitudeColumn: z.string().optional(),
  targetLatitudeColumn: z.string().optional(),
  timestampColumn: z.string().optional(),
  hexagonColumn: z.string().optional(),
  generatedTransform: z
    .object({
      kind: z.enum(['point', 'centroid', 'arc']),
      geometryColumn: z.string().optional(),
      sourceGeometryColumn: z.string().optional(),
      targetGeometryColumn: z.string().optional(),
    })
    .optional(),
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
      maxZoom: z
        .number()
        .optional()
        .describe(
          'Optional zoom cap after fitting bounds. Omit unless the user asks to limit zoom-in. Do not set 12 by default — that is city-scale and leaves neighborhood data looking far too zoomed out.',
        ),
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
  const cloned = JSON.parse(
    JSON.stringify(normalized),
  ) as DeckMapDashboardPanelConfig;
  assertDeckMapResourceConfig(cloned);
  return cloned;
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
  return createDeckMapDashboardPanelConfig({
    title: params.title || 'Map',
    ...config,
  });
}

export function createDeckMapConfigTool(): Tool {
  return tool({
    description: `Deck map config: validates and returns a reusable native Deck JSON map configuration without requiring a dashboard artifact.

Use when: a chat, agent, or artifact outside a dashboard needs a geospatial map config. ${DECK_MAP_TOOL_AUTHORING_SUMMARY}`,
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

Use when: the user asks for a map in a dashboard. ${DECK_MAP_TOOL_AUTHORING_SUMMARY}`,
    inputSchema: DeckMapDashboardToolParameters,
    execute: async (params) => {
      try {
        // Prepare/validate before mutating dashboard selection so a rejected
        // config does not switch the active table as a side effect.
        const config = cloneConfig(params.config, {
          resolveTable: (name) => databaseAdapter.findTable(name),
          stripCatalogNames,
        });
        const title = params.title || 'Map';
        const tableName =
          params.tableName ?? getFirstDatasetSourceTableName(config);

        if (tableName) {
          ensureTable(databaseAdapter, tableName);
        }

        if (tableName) {
          await dashboardAdapter.setSelectedTable(tableName);
        }
        if (params.panelId) {
          const existingPanel = ensurePanel(
            dashboardAdapter,
            params.panelId,
            DECK_MAP_DASHBOARD_PANEL_TYPE,
          );
          const updatedConfig: Record<string, unknown> =
            withPreservedDeckMapStyle(
              config,
              asDeckJsonMapConfig(existingPanel.config),
            );

          await dashboardAdapter.updatePanel(params.panelId, {
            title,
            config: updatedConfig,
          });

          return {
            llmResult: {
              success: true,
              details: `Updated map panel "${title}".`,
              data: {
                panelId: params.panelId,
                title,
                type: DECK_MAP_DASHBOARD_PANEL_TYPE,
                config: updatedConfig,
              },
            },
          };
        }

        const panel = createDeckMapDashboardPanelConfig({title, ...config});
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
