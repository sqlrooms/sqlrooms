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
import {createDeckTableDatasetSql} from './datasets/tableDatasetSql';
import type {
  DeckJsonMapProps,
  DeckSqlDatasetInput,
  DeckTableDatasetInput,
} from './types';

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
  source?: DeckMapDashboardDatasetSource;
};

export type DeckMapDashboardDatasetSource =
  | Pick<DeckSqlDatasetInput, 'sqlQuery'>
  | Pick<DeckTableDatasetInput, 'tableName' | 'transformSql'>;

export function isDeckMapDashboardSqlDatasetSource(
  source: DeckMapDashboardDatasetSource | undefined,
): source is Pick<DeckSqlDatasetInput, 'sqlQuery'> {
  return Boolean(source && 'sqlQuery' in source);
}

export function isDeckMapDashboardTableDatasetSource(
  source: DeckMapDashboardDatasetSource | undefined,
): source is Pick<DeckTableDatasetInput, 'tableName' | 'transformSql'> {
  return Boolean(source && 'tableName' in source);
}

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
}): DeckMapDashboardDatasetSource | undefined {
  const datasetSource = options.dataset?.source;
  const dashboardTable = stripCatalogPrefix(options.dashboard.selectedTable);

  // The dashboard's selected table always takes precedence as the data source.
  // When the user switches the table in the selector, structured table-backed
  // datasets update while literal SQL remains pinned to its authored query.
  if (isDeckMapDashboardSqlDatasetSource(datasetSource)) {
    return datasetSource;
  }

  const baseTableName =
    dashboardTable ||
    stripCatalogPrefix(
      isDeckMapDashboardTableDatasetSource(datasetSource)
        ? datasetSource.tableName
        : undefined,
    );
  if (!baseTableName) {
    return undefined;
  }

  const resolvedSource: DeckMapDashboardDatasetSource = {
    tableName: baseTableName,
    ...(isDeckMapDashboardTableDatasetSource(datasetSource) &&
    datasetSource.transformSql
      ? {transformSql: datasetSource.transformSql}
      : {}),
  };

  return resolvedSource;
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
  source: DeckMapDashboardDatasetSource,
  filter: unknown,
  options?: {sampleRows?: number},
) {
  const isSqlSource = isDeckMapDashboardSqlDatasetSource(source);
  const isTableSource = isDeckMapDashboardTableDatasetSource(source);
  const isDirectTableSource = isTableSource && !source.transformSql;
  const tableReference = isDirectTableSource
    ? getDeckMapDatasetSourceTableReference(source.tableName)
    : '';
  // Apply USING SAMPLE at the source level so Mosaic filters work on top.
  const sourceExpr: string = isSqlSource
    ? `(${source.sqlQuery})`
    : isDirectTableSource
      ? tableReference
      : `(${createDeckTableDatasetSql(source)})`;

  const sampledSource = options?.sampleRows
    ? `(SELECT * FROM ${sourceExpr} USING SAMPLE ${options.sampleRows} ROWS)`
    : sourceExpr;

  const query =
    isSqlSource || !isDirectTableSource || options?.sampleRows
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
