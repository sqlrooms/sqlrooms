import {
  type MosaicDashboardEntryType,
  type MosaicDashboardPanelConfigType,
  Query,
} from '@sqlrooms/mosaic';
import {
  makeQualifiedTableName,
  parseQualifiedSqlIdentifier,
  quoteParsedRawSqlTableReference,
} from '@sqlrooms/duckdb';
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

function stripCatalogPrefix(tableName: string | undefined) {
  const parsed = parseQualifiedSqlIdentifier(tableName);
  if (!parsed?.database || !parsed.schema || !parsed.table) {
    return tableName;
  }
  return makeQualifiedTableName({
    schema: parsed.schema,
    table: parsed.table,
  }).toString();
}

export function createDeckMapDashboardDatasetQuery(
  source: {tableName?: string; sqlQuery?: string},
  filter: unknown,
  options?: {sampleRows?: number},
) {
  const tableReference = source.sqlQuery
    ? ''
    : getDeckMapDatasetSourceTableReference(source.tableName);
  // Apply USING SAMPLE at the source level so Mosaic filters work on top.
  const sourceExpr: string = source.sqlQuery
    ? `(${source.sqlQuery})`
    : tableReference;

  const sampledSource = options?.sampleRows
    ? `(SELECT * FROM ${sourceExpr} USING SAMPLE ${options.sampleRows} ROWS)`
    : sourceExpr;

  const query =
    source.sqlQuery || options?.sampleRows
      ? Query.from({
          __dashboard_map_dataset: verbatim(sampledSource),
        })
      : Query.from({__dashboard_map_dataset: verbatim(tableReference)});

  return query.select('*').where(filter as never);
}

function getDeckMapDatasetSourceTableReference(tableName: string | undefined) {
  const tableReference = quoteParsedRawSqlTableReference(tableName);
  if (!tableReference) {
    throw new Error('Deck map dataset query requires a valid table source.');
  }
  return tableReference;
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
