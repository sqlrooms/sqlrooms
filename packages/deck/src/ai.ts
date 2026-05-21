import {tool, type Tool} from 'ai';
import {z} from 'zod';
import type {DashboardToolDeps} from '@sqlrooms/mosaic';
import {DECK_MAP_DASHBOARD_PANEL_TYPE} from './dashboardConfig';
import {
  createDeckMapDashboardPanelConfigForTable,
  normalizeDeckMapFillColor,
} from './mapConfigUtils';

const DeckMapColumn = z.object({
  name: z.string().describe('Column name.'),
  type: z.string().optional().describe('Optional SQL/DuckDB column type.'),
});

const DeckMapBaseToolParameters = z.object({
  title: z.string().optional().default('Map').describe('Map title.'),
  longitudeColumn: z
    .string()
    .optional()
    .describe(
      'Longitude column. If omitted, common names like longitude, lon, lng, long, or x are auto-detected from columns.',
    ),
  latitudeColumn: z
    .string()
    .optional()
    .describe(
      'Latitude column. If omitted, common names like latitude, lat, or y are auto-detected from columns.',
    ),
  geometryColumn: z
    .string()
    .optional()
    .describe(
      'Existing geometry column to render. If omitted, a WKB point geometry is generated from longitude/latitude.',
    ),
  geometryEncodingHint: z
    .enum(['geoarrow', 'wkb', 'wkt'])
    .optional()
    .describe('Encoding hint for geometryColumn. Use wkb for WKB and wkt for WKT.'),
  sqlQuery: z
    .string()
    .optional()
    .describe(
      'Optional SQL query to use as the map source. If omitted, the tableName/tableReference is used.',
    ),
  pointRadius: z
    .number()
    .optional()
    .default(4)
    .describe('Point radius in pixels for generated point maps.'),
  fillColor: z
    .array(z.number())
    .min(3)
    .max(4)
    .optional()
    .describe('RGB or RGBA fill color for generated point maps.'),
  mapStyle: z.string().optional().describe('Optional MapLibre map style URL.'),
});

export const DeckMapConfigToolParameters = DeckMapBaseToolParameters.extend({
  tableName: z
    .string()
    .describe('Table or dataset name used as the map dataset id.'),
  columns: z
    .array(DeckMapColumn)
    .optional()
    .describe(
      'Available columns for auto-detecting/validating longitude, latitude, or geometry. Provide when column names are not passed explicitly.',
    ),
  tableReference: z
    .string()
    .optional()
    .describe(
      'Optional SQL table reference to query. Defaults to tableName. Use a fully qualified name if needed.',
    ),
  reasoning: z.string().describe('Brief rationale for creating the map config.'),
});

export type DeckMapConfigToolParams = z.infer<
  typeof DeckMapConfigToolParameters
>;

export const DeckMapDashboardToolParameters = DeckMapBaseToolParameters.extend({
  artifactId: z
    .string()
    .optional()
    .describe('Optional dashboard artifact ID. Defaults to current dashboard.'),
  tableName: z
    .string()
    .optional()
    .describe('Optional table name. Use when no table is selected yet.'),
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

function getColumnsForConfig(
  params: Pick<
    DeckMapConfigToolParams,
    'columns' | 'longitudeColumn' | 'latitudeColumn' | 'geometryColumn'
  >,
) {
  if (params.columns?.length) return params.columns;

  const explicitColumns = [
    params.longitudeColumn,
    params.latitudeColumn,
    params.geometryColumn,
  ].filter((column): column is string => Boolean(column));
  if (explicitColumns.length > 0) {
    return Array.from(new Set(explicitColumns)).map((name) => ({name}));
  }

  throw new Error(
    'Provide columns for coordinate auto-detection, or pass longitudeColumn and latitudeColumn explicitly, or provide geometryColumn.',
  );
}

function createDeckMapPanelFromToolParams(params: DeckMapConfigToolParams) {
  return createDeckMapDashboardPanelConfigForTable({
    title: params.title || 'Map',
    tableName: params.tableName,
    columns: getColumnsForConfig(params),
    tableReference: params.tableReference,
    longitudeColumn: params.longitudeColumn,
    latitudeColumn: params.latitudeColumn,
    geometryColumn: params.geometryColumn,
    geometryEncodingHint: params.geometryEncodingHint,
    sourceSqlQuery: params.sqlQuery,
    pointRadius: params.pointRadius,
    fillColor: normalizeDeckMapFillColor(params.fillColor),
    mapStyle: params.mapStyle,
  });
}

export function createDeckMapConfigTool(): Tool {
  return tool({
    description: `Deck map config: creates a reusable Deck JSON map configuration without requiring a dashboard artifact.

Use when: a chat, agent, or artifact outside a dashboard needs a geospatial map config for locations, points, longitude/latitude data, or geometry columns.

For point maps, pass columns for auto-detection or pass longitudeColumn and latitudeColumn explicitly. If the table already has geometry, pass geometryColumn and geometryEncodingHint.`,
    inputSchema: DeckMapConfigToolParameters,
    execute: async (params) => {
      try {
        const panel = createDeckMapPanelFromToolParams(params);
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
    description: `Deck map panel: creates or updates an interactive geospatial map in a Mosaic dashboard.

Use when: the user asks for a map in a dashboard, geographic/spatial visualization, locations, points, longitude/latitude data, or geometry columns.

For point maps, pass longitudeColumn and latitudeColumn when column names are not obvious. If the table already has geometry, pass geometryColumn and geometryEncodingHint.`,
    inputSchema: DeckMapDashboardToolParameters,
    execute: async (params, context) => {
      try {
        const artifactId = deps.resolveArtifact(
          params.artifactId,
          params.createArtifactIfMissing,
          context,
        );
        const {tableName, columns} = deps.resolveTable(
          artifactId,
          params.tableName,
        );
        const panel = createDeckMapPanelFromToolParams({
          title: params.title || 'Map',
          tableName,
          columns,
          longitudeColumn: params.longitudeColumn,
          latitudeColumn: params.latitudeColumn,
          geometryColumn: params.geometryColumn,
          geometryEncodingHint: params.geometryEncodingHint,
          sqlQuery: params.sqlQuery,
          pointRadius: params.pointRadius,
          fillColor: params.fillColor,
          mapStyle: params.mapStyle,
          reasoning: params.reasoning,
        });

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
