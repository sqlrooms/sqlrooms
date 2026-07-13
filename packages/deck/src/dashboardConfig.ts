import {
  type MosaicDashboardEntryType,
  type MosaicDashboardPanelConfigType,
  Query,
} from '@sqlrooms/mosaic';
import {
  getTableIdentity,
  makeQualifiedTableName,
  parseQualifiedSqlIdentifier,
  quoteParsedRawSqlTableReference,
} from '@sqlrooms/duckdb';
import {verbatim} from '@uwdata/mosaic-sql';
import type {Table as ArrowTable} from 'apache-arrow';
import {createDeckTableDatasetSql} from './datasets/tableDatasetSql';
import {
  isDeckMapDashboardSqlDatasetSource,
  isDeckMapDashboardTableDatasetSource,
  type DeckMapDashboardDatasetConfig,
  type DeckMapDashboardDatasetSource,
  type DeckMapDashboardFitToDataConfig,
  type DeckMapDashboardPanelConfig,
} from './mapConfig';
export {
  asDeckJsonMapConfig,
  createDeckMapDashboardPanelConfig,
  DECK_MAP_DASHBOARD_PANEL_TYPE,
  DEFAULT_DECK_MAP_MAX_DATA_POINTS,
  isDeckMapDashboardSqlDatasetSource,
  isDeckMapDashboardTableDatasetSource,
} from './mapConfig';
export type {
  CreateDeckMapDashboardPanelConfigOptions,
  DeckMapDashboardDatasetConfig,
  DeckMapDashboardDatasetSource,
  DeckMapDashboardFitToDataConfig,
  DeckMapDashboardInteractionConfig,
  DeckMapDashboardPanelConfig,
} from './mapConfig';
export type {DeckJsonMapProps} from './types';
import type {DeckJsonMapProps} from './types';

export type DeckMapDashboardDatasetClientState = {
  arrowTable?: ArrowTable;
  isLoading: boolean;
  error?: Error;
  client: unknown;
  isSampled?: boolean;
};

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
    (isDeckMapDashboardTableDatasetSource(datasetSource)
      ? datasetSource.tableName
      : undefined);
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
  return getTableIdentity(
    makeQualifiedTableName({
      schema: parsed.schema,
      table: parsed.table,
    }),
  );
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
