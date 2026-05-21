import {tool, type Tool} from 'ai';
import {z} from 'zod';
import type {DashboardToolDeps} from '@sqlrooms/mosaic';
import {
  createDeckMapDashboardPanelConfig,
  DECK_MAP_DASHBOARD_PANEL_TYPE,
  type DeckMapDashboardPanelConfig,
} from './dashboardConfig';

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
  reasoning: z.string().describe('Brief rationale for creating the map config.'),
});

export type DeckMapConfigToolParams = z.infer<
  typeof DeckMapConfigToolParameters
>;

export const DeckMapDashboardToolParameters = DeckMapConfigToolParameters.extend({
  artifactId: z
    .string()
    .optional()
    .describe('Optional dashboard artifact ID. Defaults to current dashboard.'),
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
  reasoning: z.string().describe('Brief rationale for creating the map panel.'),
});

export type DeckMapDashboardToolParams = z.infer<
  typeof DeckMapDashboardToolParameters
>;

function cloneConfig(
  config: DeckMapDashboardConfigToolConfig,
): DeckMapDashboardPanelConfig {
  return JSON.parse(JSON.stringify(config)) as DeckMapDashboardPanelConfig;
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

Use when: a chat, agent, or artifact outside a dashboard needs a geospatial map config. Author the map using native Deck JSON: put layer classes in spec.layers[].@@type, bind layers to datasets through _sqlroomsBinding.dataset, and put tableName or sqlQuery sources in config.datasets.`,
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

Use when: the user asks for a map in a dashboard. Author the map using native Deck JSON: choose layer classes with spec.layers[].@@type, bind layers to datasets through _sqlroomsBinding.dataset, and put tableName or sqlQuery sources in config.datasets.`,
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
              `Panel "${params.panelId}" is not a map panel. Cannot update it with create_dashboard_map.`,
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
    create_dashboard_map: createDeckMapDashboardTool(deps),
  };
}
