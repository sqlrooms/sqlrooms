import {
  type MosaicDashboardEntryType,
  type MosaicDashboardPanelConfigType,
  type MosaicDashboardPanelSourceType,
  Query,
} from '@sqlrooms/mosaic';
import {createId} from '@paralleldrive/cuid2';
import {verbatim} from '@uwdata/mosaic-sql';
import type {Table as ArrowTable} from 'apache-arrow';
import type {DeckJsonMapProps, DeckSqlDatasetInput} from './types';

export const DECK_MAP_DASHBOARD_PANEL_TYPE = 'deck-json-map';

export type DeckMapDashboardDatasetConfig = Omit<
  DeckSqlDatasetInput,
  'sqlQuery'
> & {
  source?: MosaicDashboardPanelSourceType;
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
};

export type CreateDeckMapDashboardPanelConfigOptions =
  DeckMapDashboardPanelConfig & {
    title?: string;
    source?: MosaicDashboardPanelSourceType;
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
): MosaicDashboardPanelConfigType {
  const {title, source, ...config} = options;
  return {
    id: createId(),
    type: DECK_MAP_DASHBOARD_PANEL_TYPE,
    title: title ?? 'Map',
    ...(source ? {source} : {}),
    config: JSON.parse(JSON.stringify(config)) as Record<string, unknown>,
  };
}

export function resolveDeckMapDashboardDatasetSource(options: {
  dashboard: MosaicDashboardEntryType;
  panel: MosaicDashboardPanelConfigType;
  dataset?: DeckMapDashboardDatasetConfig;
}): MosaicDashboardPanelSourceType | undefined {
  const datasetSource = options.dataset?.source;
  if (datasetSource?.sqlQuery || datasetSource?.tableName) {
    return datasetSource;
  }
  if (options.panel.source?.sqlQuery || options.panel.source?.tableName) {
    return options.panel.source;
  }
  return options.dashboard.selectedTable
    ? {tableName: options.dashboard.selectedTable}
    : undefined;
}

export function createDeckMapDashboardDatasetQuery(
  source: MosaicDashboardPanelSourceType,
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
