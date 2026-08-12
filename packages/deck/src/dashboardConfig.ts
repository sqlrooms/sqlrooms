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
import {wrapSqlGeometryColumnsAsWkb} from './datasets/wrapGeometryAsWkb';
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
  /**
   * Native GEOMETRY column names projected through `ST_AsWKB` for this query.
   * Only force `geometryEncodingHint: "wkb"` when the configured geometry
   * column is in this list — wrapping an unrelated column must not retarget
   * a WKT/GeoArrow binding.
   */
  wrappedGeometryColumnNames?: readonly string[];
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

/**
 * Compiles the unfiltered dataset SQL used for DESCRIBE probes and as the
 * Mosaic source expression (before sampling / filters).
 */
export function createDeckMapDashboardDatasetSourceSql(
  source: DeckMapDashboardDatasetSource,
): string {
  if (isDeckMapDashboardSqlDatasetSource(source)) {
    return source.sqlQuery.trim().replace(/(?:\s*;+\s*)+$/, '');
  }
  if (
    isDeckMapDashboardTableDatasetSource(source) &&
    !source.transformSql?.trim()
  ) {
    return `SELECT * FROM ${getDeckMapDatasetSourceTableReference(source.tableName)}`;
  }
  return createDeckTableDatasetSql(source);
}

export function createDeckMapDashboardDatasetQuery(
  source: DeckMapDashboardDatasetSource,
  filter: unknown,
  options?: {
    sampleRows?: number;
    /** Native GEOMETRY columns to project with ST_AsWKB (from DESCRIBE). */
    geometryColumnsToWrapAsWkb?: readonly string[];
  },
) {
  const isSqlSource = isDeckMapDashboardSqlDatasetSource(source);
  const isTableSource = isDeckMapDashboardTableDatasetSource(source);
  const isDirectTableSource = isTableSource && !source.transformSql;
  const tableReference = isDirectTableSource
    ? getDeckMapDatasetSourceTableReference(source.tableName)
    : '';

  const baseSql = createDeckMapDashboardDatasetSourceSql(source);

  // Sample before WKB projection so ST_AsWKB runs only on the sampled rows.
  const sampledSql = options?.sampleRows
    ? `SELECT * FROM (${baseSql}) AS "__sqlrooms_sample_source" USING SAMPLE ${options.sampleRows} ROWS`
    : baseSql;

  const wrappedSql = wrapSqlGeometryColumnsAsWkb(
    sampledSql,
    options?.geometryColumnsToWrapAsWkb ?? [],
  );
  const usedWrap = Boolean(wrappedSql);

  let sourceExpr: string;
  if (wrappedSql) {
    sourceExpr = `(${wrappedSql})`;
  } else if (options?.sampleRows) {
    sourceExpr = `(${sampledSql})`;
  } else if (isSqlSource) {
    sourceExpr = `(${source.sqlQuery})`;
  } else if (isDirectTableSource) {
    sourceExpr = tableReference;
  } else {
    sourceExpr = `(${createDeckTableDatasetSql(source)})`;
  }

  const query =
    usedWrap || options?.sampleRows || isSqlSource || !isDirectTableSource
      ? Query.from({
          __dashboard_map_dataset: verbatim(sourceExpr),
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
    Pick<
      DeckMapDashboardDatasetClientState,
      'arrowTable' | 'wrappedGeometryColumnNames'
    >
  >,
): DeckJsonMapProps['datasets'] {
  return Object.fromEntries(
    Object.entries(mapConfig.datasets).map(([datasetId, dataset]) => {
      const wrapped =
        datasetStates[datasetId]?.wrappedGeometryColumnNames ?? [];
      const geometryColumn = dataset.geometryColumn;
      const wrappedConfiguredColumn =
        typeof geometryColumn === 'string' &&
        geometryColumn.length > 0 &&
        wrapped.includes(geometryColumn);
      return [
        datasetId,
        {
          arrowTable: datasetStates[datasetId]?.arrowTable,
          geometryColumn,
          geometryEncodingHint: wrappedConfiguredColumn
            ? 'wkb'
            : dataset.geometryEncodingHint,
        },
      ];
    }),
  );
}
