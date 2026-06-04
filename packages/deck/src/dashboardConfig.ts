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
}): {tableName?: string; sqlQuery?: string} | undefined {
  const datasetSource = options.dataset?.source;
  if (datasetSource?.sqlQuery || datasetSource?.tableName) {
    return datasetSource;
  }
  return options.dashboard.selectedTable
    ? {tableName: options.dashboard.selectedTable}
    : undefined;
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
