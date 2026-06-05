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
  longitudeColumn: string;
  latitudeColumn: string;
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
  const resolvedSource =
    datasetSource?.sqlQuery || datasetSource?.tableName
      ? datasetSource
      : options.dashboard.selectedTable
        ? {tableName: options.dashboard.selectedTable}
        : undefined;

  if (!resolvedSource || resolvedSource.sqlQuery || !resolvedSource.tableName) {
    return resolvedSource;
  }

  // When the dataset expects a geometry column but the source is a plain
  // tableName, generate SQL that creates the geometry from coordinate columns.
  const geometryColumn = options.dataset?.geometryColumn;
  if (!geometryColumn) {
    return resolvedSource;
  }

  // Try fitToData first, then interaction config for coordinate columns.
  const interaction = (options.panel.config as Record<string, unknown>)
    ?.interaction as
    | {longitudeColumn?: string; latitudeColumn?: string}
    | undefined;
  const lonCol =
    options.fitToData?.longitudeColumn || interaction?.longitudeColumn;
  const latCol =
    options.fitToData?.latitudeColumn || interaction?.latitudeColumn;

  if (lonCol && latCol) {
    return buildGeometrySourceSql(
      resolvedSource.tableName,
      lonCol,
      latCol,
      geometryColumn,
    );
  }

  // Last resort: when geometryEncodingHint signals synthesis ('wkb' or
  // unspecified), try common coordinate column names using DuckDB unquoted
  // identifiers (case-insensitive resolution). Tables that genuinely have a
  // geometry column would typically have geometryEncodingHint as 'geoarrow'
  // or would already have a sqlQuery/no geometryColumn configured.
  if (options.dataset?.geometryEncodingHint !== 'geoarrow') {
    const quote = (id: string) => `"${id.replace(/"/g, '""')}"`;
    const tableParts = resolvedSource.tableName.split('.').map(quote).join('.');
    return {
      sqlQuery: [
        `SELECT *, ST_AsWKB(ST_Point(Longitude, Latitude)) AS ${quote(geometryColumn)}`,
        `FROM ${tableParts}`,
        `WHERE Longitude IS NOT NULL AND Latitude IS NOT NULL`,
      ].join(' '),
    };
  }

  return resolvedSource;
}

function buildGeometrySourceSql(
  tableName: string,
  lonCol: string,
  latCol: string,
  geometryColumn: string,
): {sqlQuery: string} {
  const quote = (id: string) => `"${id.replace(/"/g, '""')}"`;
  const tableParts = tableName.split('.').map(quote).join('.');
  return {
    sqlQuery: [
      `SELECT *, ST_AsWKB(ST_Point(${quote(lonCol)}, ${quote(latCol)})) AS ${quote(geometryColumn)}`,
      `FROM ${tableParts}`,
      `WHERE ${quote(lonCol)} IS NOT NULL AND ${quote(latCol)} IS NOT NULL`,
    ].join(' '),
  };
}

export function createDeckMapDashboardDatasetQuery(
  source: {tableName?: string; sqlQuery?: string},
  filter: unknown,
) {
  const query = source.sqlQuery
    ? Query.from({
        __dashboard_map_dataset: verbatim(`(${source.sqlQuery})`),
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
