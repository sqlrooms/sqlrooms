import {tool, type Tool} from 'ai';
import {z} from 'zod';
import {
  DASHBOARD_AI_INSTRUCTIONS,
  MAP_TOOL_KEY,
  createDashboardAgentTool,
  createDashboardAiTools as createMosaicDashboardAiTools,
  type CreateDashboardAgentToolOptions,
  type CreateDashboardAiToolsOptions,
  type DashboardToolDeps,
} from '@sqlrooms/mosaic';
import {
  createDeckMapDashboardPanelConfig,
  DECK_MAP_DASHBOARD_PANEL_TYPE,
  type DeckMapDashboardPanelConfig,
} from './dashboardConfig';
import {quoteDeckMapSqlIdentifier} from './mapConfigUtils';

export const DECK_MAP_AI_INSTRUCTIONS = `
Deck map tools:
- create_deck_map_config validates and returns a reusable native Deck JSON map config without requiring a dashboard artifact.
- create_dashboard_map creates or updates an interactive map panel inside a dashboard from a native Deck JSON map config.
- Use map tools when the user asks for a map, geospatial/spatial visualization, locations, longitude/latitude data, or geometry columns.
- Author maps with config.spec.layers using Deck JSON layer classes in @@type, such as GeoArrowScatterplotLayer, GeoArrowHeatmapLayer, GeoArrowPolygonLayer, GeoArrowPathLayer, or GeoArrowArcLayer.
- Bind layers to datasets with _sqlroomsBinding.dataset and put tableName or sqlQuery sources in config.datasets.
- IMPORTANT: For point data with longitude/latitude columns, the dataset source MUST use a sqlQuery that creates a geometry column, for example: "SELECT *, ST_AsWKB(ST_Point(\\"Longitude\\", \\"Latitude\\")) AS \\"__sqlrooms_geom\\" FROM tableName WHERE \\"Longitude\\" IS NOT NULL AND \\"Latitude\\" IS NOT NULL". Set geometryColumn to the same name used in the AS clause (e.g. "__sqlrooms_geom") and geometryEncodingHint to "wkb".
- IMPORTANT: When providing fitToData, ALWAYS include longitudeColumn and latitudeColumn with the actual column names from the data (e.g. "Longitude", "Latitude"). Missing column names will cause SQL errors.
- For data-driven color, use native Deck JSON accessors with {"@@function":"colorScale", "field":"...", "type":"sequential"|"diverging"|"quantize"|"quantile"|"categorical", "scheme":"Viridis", "domain":"auto"} on color properties such as getFillColor, getLineColor, getColor, getSourceColor, or getTargetColor.
- Map panels default to a 100000-row runtime data limit; use config.dataPolicy.maxRows only when the map genuinely needs a panel-specific limit.
- After calling create_dashboard_map, call list_dashboard_panels before your final response and check the map panel issue. If it has a render-error, repair the map config in place instead of saying the map is complete.
`;

function createDeckMapDashboardExtraTools(
  extraTools?: (deps: DashboardToolDeps) => Record<string, Tool>,
) {
  return (deps: DashboardToolDeps) => ({
    ...createDeckMapDashboardAiTools(deps),
    ...(extraTools?.(deps) ?? {}),
  });
}

export function getDashboardWithDeckMapAiInstructions() {
  return `${DASHBOARD_AI_INSTRUCTIONS.trim()}\n\n${DECK_MAP_AI_INSTRUCTIONS.trim()}`;
}

export function createDashboardWithDeckMapAiTools<TState>(
  options: CreateDashboardAiToolsOptions<TState>,
): Record<string, Tool> {
  return createMosaicDashboardAiTools({
    ...options,
    extraTools: createDeckMapDashboardExtraTools(options.extraTools),
  });
}

export function createDashboardAgentToolWithDeckMaps<TState>(
  options: CreateDashboardAgentToolOptions<TState>,
): Tool {
  return createDashboardAgentTool({
    ...options,
    extraTools: createDeckMapDashboardExtraTools(options.extraTools),
  }) as Tool;
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
    'Deck JSON map spec as an object. Use spec.layers[].@@type for layer classes such as GeoArrowScatterplotLayer, GeoArrowHeatmapLayer, GeoArrowPolygonLayer, GeoArrowPathLayer, or GeoArrowArcLayer.',
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
    artifactId: z
      .string()
      .optional()
      .describe(
        'Optional dashboard artifact ID. Defaults to current dashboard.',
      ),
    tableName: z
      .string()
      .optional()
      .describe(
        'Optional table name used only to select/resolve the target dashboard table. Data sources still come from config.datasets.',
      ),
    createArtifactIfMissing: z
      .boolean()
      .optional()
      .default(true)
      .describe('If true, create dashboard artifact if missing.'),
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
  const fitToData = config.fitToData as
    | Record<string, unknown>
    | null
    | undefined;

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
  const tableParts = source.tableName
    .split('.')
    .map((p) => quoteDeckMapSqlIdentifier(p))
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

export function createDeckMapConfigTool(): Tool {
  return tool({
    description: `Deck map config: validates and returns a reusable native Deck JSON map configuration without requiring a dashboard artifact.

Use when: a chat, agent, or artifact outside a dashboard needs a geospatial map config. Author the map using native Deck JSON: put layer classes in spec.layers[].@@type, bind layers to datasets through _sqlroomsBinding.dataset, and put tableName or sqlQuery sources in config.datasets. For data-driven colors, use color accessors such as getFillColor, getLineColor, getColor, getSourceColor, or getTargetColor with {"@@function":"colorScale", "field":"...", "type":"sequential"|"diverging"|"quantize"|"quantile"|"categorical", "scheme":"Viridis", "domain":"auto"}.`,
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

export function createDeckMapAiTools(): Record<string, Tool> {
  return {
    create_deck_map_config: createDeckMapConfigTool(),
  };
}

export function createDeckMapDashboardTool(deps: DashboardToolDeps): Tool {
  return tool({
    description: `Deck map panel: creates or updates an interactive geospatial map panel in a Mosaic dashboard from a native Deck JSON config.

Use when: the user asks for a map in a dashboard. Author the map using native Deck JSON: choose layer classes with spec.layers[].@@type, bind layers to datasets through _sqlroomsBinding.dataset, and put tableName or sqlQuery sources in config.datasets. For data-driven colors, use color accessors such as getFillColor, getLineColor, getColor, getSourceColor, or getTargetColor with {"@@function":"colorScale", "field":"...", "type":"sequential"|"diverging"|"quantize"|"quantile"|"categorical", "scheme":"Viridis", "domain":"auto"}.`,
    inputSchema: DeckMapDashboardToolParameters,
    execute: async (params, context) => {
      try {
        const artifactId = deps.resolveArtifact(
          params.artifactId,
          params.createArtifactIfMissing,
          context,
        );
        if (params.tableName) {
          deps.resolveTable(artifactId, params.tableName);
        }
        const panel = createDeckMapPanelFromNativeConfig(params);

        if (params.panelId) {
          const dashboard = deps.getDashboard(artifactId);
          const existingPanel = dashboard?.panels.find(
            (candidate) => candidate.id === params.panelId,
          );
          if (!existingPanel) {
            throw new Error(
              `Panel "${params.panelId}" not found in dashboard "${artifactId}". Cannot update.`,
            );
          }
          if (existingPanel.type !== DECK_MAP_DASHBOARD_PANEL_TYPE) {
            throw new Error(
              `Panel "${params.panelId}" is not a map panel. Cannot update it with ${MAP_TOOL_KEY}.`,
            );
          }
          deps.updatePanel(artifactId, params.panelId, {
            title: panel.title,
            config: panel.config,
          } as never);

          return {
            llmResult: {
              success: true,
              details: `Updated map panel "${panel.title}".`,
              data: {
                panelId: params.panelId,
                artifactId,
                title: panel.title,
                type: DECK_MAP_DASHBOARD_PANEL_TYPE,
                config: panel.config,
              },
            },
          };
        }

        const panelId = deps.addPanel(artifactId, panel);
        deps.setCurrentArtifact(artifactId);

        return {
          llmResult: {
            success: true,
            details: `Created map panel "${panel.title}".`,
            data: {
              panelId,
              artifactId,
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
  deps: DashboardToolDeps,
): Record<string, Tool> {
  return {
    [MAP_TOOL_KEY]: createDeckMapDashboardTool(deps),
  };
}
