import {tool, type Tool} from 'ai';
import {z} from 'zod';
import type {DashboardToolDeps} from '@sqlrooms/mosaic';
import {
  createDeckMapDashboardPanelConfig,
  DECK_MAP_DASHBOARD_PANEL_TYPE,
  type DeckMapDashboardPanelConfig,
} from './dashboardConfig';

const LONGITUDE_COLUMN_NAMES = ['longitude', 'lon', 'lng', 'long', 'x'];
const LATITUDE_COLUMN_NAMES = ['latitude', 'lat', 'y'];
const DEFAULT_GEOMETRY_COLUMN = '__sqlrooms_geom';

export const DeckMapDashboardToolParameters = z.object({
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
  title: z.string().optional().default('Map').describe('Map panel title.'),
  longitudeColumn: z
    .string()
    .optional()
    .describe(
      'Longitude column. If omitted, common names like longitude, lon, lng, long, or x are auto-detected.',
    ),
  latitudeColumn: z
    .string()
    .optional()
    .describe(
      'Latitude column. If omitted, common names like latitude, lat, or y are auto-detected.',
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
      'Optional SQL query to use as the map source. If omitted, the selected table is used.',
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
  reasoning: z.string().describe('Brief rationale for creating the map panel.'),
});

export type DeckMapDashboardToolParams = z.infer<
  typeof DeckMapDashboardToolParameters
>;

function quoteSqlIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function quoteTableReference(tableName: string) {
  return tableName
    .split('.')
    .map((part) => quoteSqlIdentifier(part))
    .join('.');
}

function findColumnByName(
  columns: {name: string}[],
  candidates: string[],
): string | undefined {
  const candidateSet = new Set(candidates);
  return columns.find((column) =>
    candidateSet.has(column.name.toLowerCase()),
  )?.name;
}

function ensureColumnExists(
  columns: {name: string}[],
  columnName: string,
  role: string,
) {
  if (!columns.some((column) => column.name === columnName)) {
    throw new Error(
      `Unknown ${role} column "${columnName}". Available columns: ${columns
        .map((column) => column.name)
        .join(', ')}.`,
    );
  }
}

function resolveCoordinateColumns(options: {
  columns: {name: string}[];
  longitudeColumn?: string;
  latitudeColumn?: string;
}) {
  const longitudeColumn =
    options.longitudeColumn ??
    findColumnByName(options.columns, LONGITUDE_COLUMN_NAMES);
  const latitudeColumn =
    options.latitudeColumn ??
    findColumnByName(options.columns, LATITUDE_COLUMN_NAMES);

  if (!longitudeColumn || !latitudeColumn) {
    throw new Error(
      'Could not find longitude/latitude columns. Pass longitudeColumn and latitudeColumn explicitly, or provide geometryColumn.',
    );
  }

  ensureColumnExists(options.columns, longitudeColumn, 'longitude');
  ensureColumnExists(options.columns, latitudeColumn, 'latitude');
  return {longitudeColumn, latitudeColumn};
}

function createPointSourceSql(options: {
  tableName: string;
  sqlQuery?: string;
  longitudeColumn: string;
  latitudeColumn: string;
  geometryColumn: string;
}) {
  const quotedLongitude = quoteSqlIdentifier(options.longitudeColumn);
  const quotedLatitude = quoteSqlIdentifier(options.latitudeColumn);
  const baseSource = options.sqlQuery
    ? `(${options.sqlQuery}) AS "__sqlrooms_dashboard_map_source"`
    : quoteTableReference(options.tableName);

  return [
    `SELECT *, ST_AsWKB(ST_Point(${quotedLongitude}, ${quotedLatitude})) AS ${quoteSqlIdentifier(options.geometryColumn)}`,
    `FROM ${baseSource}`,
    `WHERE ${quotedLongitude} IS NOT NULL AND ${quotedLatitude} IS NOT NULL`,
  ].join(' ');
}

function normalizeFillColor(
  fillColor?: number[],
): [number, number, number] | [number, number, number, number] {
  if (fillColor?.length === 3) {
    return [fillColor[0]!, fillColor[1]!, fillColor[2]!];
  }
  if (fillColor?.length === 4) {
    return [fillColor[0]!, fillColor[1]!, fillColor[2]!, fillColor[3]!];
  }
  return [56, 189, 248, 180];
}

function createMapPanelConfig(options: {
  title: string;
  tableName: string;
  columns: {name: string}[];
  longitudeColumn?: string;
  latitudeColumn?: string;
  geometryColumn?: string;
  geometryEncodingHint?: 'geoarrow' | 'wkb' | 'wkt';
  sqlQuery?: string;
  pointRadius: number;
  fillColor: [number, number, number] | [number, number, number, number];
  mapStyle?: string;
}) {
  const datasetId = options.tableName;
  const explicitGeometryColumn = options.geometryColumn?.trim() || undefined;
  const coordinates = explicitGeometryColumn
    ? undefined
    : resolveCoordinateColumns({
        columns: options.columns,
        longitudeColumn: options.longitudeColumn,
        latitudeColumn: options.latitudeColumn,
      });
  const geometryColumn = explicitGeometryColumn ?? DEFAULT_GEOMETRY_COLUMN;
  const source = coordinates
    ? {
        sqlQuery: createPointSourceSql({
          tableName: options.tableName,
          sqlQuery: options.sqlQuery,
          longitudeColumn: coordinates.longitudeColumn,
          latitudeColumn: coordinates.latitudeColumn,
          geometryColumn,
        }),
      }
    : options.sqlQuery
      ? {sqlQuery: options.sqlQuery}
      : {tableName: options.tableName};

  if (explicitGeometryColumn) {
    ensureColumnExists(options.columns, explicitGeometryColumn, 'geometry');
  }

  const config: DeckMapDashboardPanelConfig = {
    spec: {
      initialViewState: {longitude: 0, latitude: 20, zoom: 1.5},
      layers: [
        {
          '@@type': 'GeoArrowScatterplotLayer',
          id: datasetId,
          _sqlroomsBinding: {dataset: datasetId},
          filled: true,
          stroked: false,
          pickable: true,
          radiusUnits: 'pixels',
          getRadius: options.pointRadius,
          getFillColor: options.fillColor,
        },
      ],
    },
    datasets: {
      [datasetId]: {
        source,
        geometryColumn,
        geometryEncodingHint: explicitGeometryColumn
          ? options.geometryEncodingHint
          : 'wkb',
      },
    },
    ...(coordinates
      ? {
          fitToData: {
            dataset: datasetId,
            longitudeColumn: coordinates.longitudeColumn,
            latitudeColumn: coordinates.latitudeColumn,
            padding: 40,
            maxZoom: 12,
          },
        }
      : {}),
    ...(options.mapStyle ? {mapStyle: options.mapStyle} : {}),
  };

  return createDeckMapDashboardPanelConfig({
    title: options.title,
    ...config,
  });
}

export function createDeckMapDashboardTool(deps: DashboardToolDeps): Tool {
  return tool({
    description: `Deck map panel: creates or updates an interactive geospatial map in a Mosaic dashboard.

Use when: the user asks for a map, geographic/spatial visualization, locations, points, longitude/latitude data, or geometry columns.

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
        const panel = createMapPanelConfig({
          title: params.title || 'Map',
          tableName,
          columns,
          longitudeColumn: params.longitudeColumn,
          latitudeColumn: params.latitudeColumn,
          geometryColumn: params.geometryColumn,
          geometryEncodingHint: params.geometryEncodingHint,
          sqlQuery: params.sqlQuery,
          pointRadius: params.pointRadius,
          fillColor: normalizeFillColor(params.fillColor),
          mapStyle: params.mapStyle,
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
