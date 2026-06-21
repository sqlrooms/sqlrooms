import {
  type MosaicDashboardEntryType,
  type MosaicDashboardPanelConfigType,
  Query,
} from '@sqlrooms/mosaic';
import {createId} from '@paralleldrive/cuid2';
import {verbatim} from '@uwdata/mosaic-sql';
import type {Table as ArrowTable} from 'apache-arrow';
import type {DeckJsonMapProps, DeckSqlDatasetInput} from './types';

export const DECK_MAP_DASHBOARD_PANEL_TYPE = 'deck-json-map';
export const DEFAULT_DECK_MAP_MAX_DATA_POINTS = 100_000;

export type DeckMapDataPolicyOverride = {
  disabled?: boolean;
  maxRows?: number;
  reason?: string;
};

export type DeckMapDashboardDatasetConfig = Omit<
  DeckSqlDatasetInput,
  'sqlQuery'
> & {
  source?: {tableName?: string; sqlQuery?: string};
};

export type DeckMapDashboardInteractionConfig = {
  type: 'point-radius-brush';
  dataset: string;
  longitudeColumn: string;
  latitudeColumn: string;
  radiusMeters?: number;
  event?: 'hover' | 'click';
};

export type DeckMapDashboardFitToDataConfig = {
  dataset: string;
  longitudeColumn?: string;
  latitudeColumn?: string;
  /** Geometry column name (WKB) for computing bounds from geometry directly. */
  geometryColumn?: string;
  /** H3 hex index column for computing bounds from H3 cells. */
  h3Column?: string;
  padding?: number;
  maxZoom?: number;
};

export type DeckMapDashboardPanelConfig = {
  spec: DeckJsonMapProps['spec'];
  datasets: Record<string, DeckMapDashboardDatasetConfig>;
  mapStyle?: string;
  mapProps?: Record<string, unknown>;
  showLegends?: boolean;
  interaction?: DeckMapDashboardInteractionConfig;
  fitToData?: DeckMapDashboardFitToDataConfig;
  dataPolicy?: DeckMapDataPolicyOverride;
  settingsOpen?: boolean;
};

export type CreateDeckMapDashboardPanelConfigOptions =
  DeckMapDashboardPanelConfig & {
    title?: string;
  };

export type DeckMapDashboardDatasetClientState = {
  arrowTable?: ArrowTable;
  isLoading: boolean;
  error?: Error;
  client: unknown;
  isSampled?: boolean;
};

export function asDeckJsonMapConfig(
  config: Record<string, unknown>,
): DeckMapDashboardPanelConfig | null {
  if (
    !config.spec ||
    !config.datasets ||
    typeof config.datasets !== 'object' ||
    Array.isArray(config.datasets)
  ) {
    return null;
  }

  return config as DeckMapDashboardPanelConfig;
}

export function createDeckMapDashboardPanelConfig(
  options: CreateDeckMapDashboardPanelConfigOptions,
): any {
  const {title, ...config} = options;
  return {
    id: createId(),
    type: DECK_MAP_DASHBOARD_PANEL_TYPE,
    title: title ?? 'Map',
    config: JSON.parse(JSON.stringify(config)) as Record<string, unknown>,
  };
}

export function resolveDeckMapDashboardDatasetSource(options: {
  dashboard: MosaicDashboardEntryType;
  panel: MosaicDashboardPanelConfigType;
  dataset?: DeckMapDashboardDatasetConfig;
  fitToData?: DeckMapDashboardFitToDataConfig;
}): {tableName?: string; sqlQuery?: string} | undefined {
  const datasetSource = options.dataset?.source;
  const dashboardTable = stripCatalogPrefix(options.dashboard.selectedTable);

  // The dashboard's selected table always takes precedence as the data source.
  // When the user switches the table in the selector, all panels update.
  const baseTableName = dashboardTable || datasetSource?.tableName;
  if (!baseTableName && !datasetSource?.sqlQuery) {
    return undefined;
  }

  // If the dataset has a sqlQuery and the dashboard table differs from the
  // original source table, rewrite the FROM clause to use the new table.
  if (datasetSource?.sqlQuery && dashboardTable) {
    const originalTable = datasetSource.tableName;
    const quote = (id: string) => `"${id.replace(/"/g, '""')}"`;
    const quotedDashboard = dashboardTable.includes('"')
      ? dashboardTable
      : dashboardTable.split('.').map(quote).join('.');

    if (originalTable && dashboardTable !== originalTable) {
      const quotedOriginal = originalTable.split('.').map(quote).join('.');
      const rewritten = datasetSource.sqlQuery
        .replace(
          new RegExp(
            `\\bFROM\\s+${escapeRegExp(originalTable)}(?=\\s|$|[,;)\\[\\]])`,
            'gi',
          ),
          `FROM ${quotedDashboard}`,
        )
        .replace(
          new RegExp(
            `\\bFROM\\s+${escapeRegExp(quotedOriginal)}(?=\\s|$|[,;)\\[\\]])`,
            'gi',
          ),
          `FROM ${quotedDashboard}`,
        );
      return {sqlQuery: rewritten};
    }

    if (!originalTable) {
      // No explicit tableName — replace the first FROM <identifier> with the dashboard table.
      const rewritten = datasetSource.sqlQuery.replace(
        /\bFROM\s+((?:"[^"]*"(?:\."[^"]*")*)|(?:[a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)*))(?=\s|$|[,;)[\]])/i,
        `FROM ${quotedDashboard}`,
      );
      if (rewritten !== datasetSource.sqlQuery) {
        return {sqlQuery: rewritten};
      }
    }

    return datasetSource;
  }

  const resolvedSource = {tableName: baseTableName!};

  return resolvedSource;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Strips the catalog/database and schema prefixes from a fully qualified table name.
 * DuckDB queries run in a context where the catalog prefix is not valid,
 * and the default schema is typically "main".
 * E.g. "sqlrooms-cli"."main"."earthquakes" → earthquakes
 *      "main"."earthquakes" → earthquakes
 *      earthquakes → earthquakes (unchanged)
 */
function stripCatalogPrefix(tableName: string | undefined): string | undefined {
  if (!tableName) return tableName;
  // Split on dots that are outside quotes
  const parts: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < tableName.length; i++) {
    const ch = tableName[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if (ch === '.' && !inQuotes) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);

  // Use the last part (bare table name), stripping quotes
  const lastPart = parts[parts.length - 1] ?? tableName;
  // Remove surrounding quotes if present
  if (lastPart.startsWith('"') && lastPart.endsWith('"')) {
    return lastPart.slice(1, -1);
  }
  return lastPart;
}

export function createDeckMapDashboardDatasetQuery(
  source: {tableName?: string; sqlQuery?: string},
  filter: unknown,
  options?: {sampleRows?: number},
) {
  // Apply USING SAMPLE at the source level so Mosaic filters work on top.
  const sourceExpr = source.sqlQuery
    ? `(${source.sqlQuery})`
    : (source.tableName ?? '');

  const sampledSource = options?.sampleRows
    ? `(SELECT * FROM ${sourceExpr} USING SAMPLE ${options.sampleRows} ROWS)`
    : sourceExpr;

  const query =
    source.sqlQuery || options?.sampleRows
      ? Query.from({
          __dashboard_map_dataset: verbatim(sampledSource),
        })
      : Query.from(source.tableName ?? '');

  return query.select('*').where(filter as never);
}

export function createDeckMapDashboardDatasets(
  mapConfig: DeckMapDashboardPanelConfig,
  datasetStates: Record<
    string,
    Pick<DeckMapDashboardDatasetClientState, 'arrowTable'>
  >,
): DeckJsonMapProps['datasets'] {
  return Object.fromEntries(
    Object.entries(mapConfig.datasets).map(([datasetId, dataset]) => [
      datasetId,
      {
        arrowTable: datasetStates[datasetId]?.arrowTable,
        geometryColumn: dataset.geometryColumn,
        geometryEncodingHint: dataset.geometryEncodingHint,
      },
    ]),
  );
}
