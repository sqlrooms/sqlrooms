import {createId} from '@paralleldrive/cuid2';
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

export type DeckMapDatasetSource =
  | Pick<DeckSqlDatasetInput, 'sqlQuery'>
  | Pick<DeckTableDatasetInput, 'tableName' | 'transformSql'>;

export type DeckMapDatasetConfig = Omit<DeckSqlDatasetInput, 'sqlQuery'> & {
  source?: DeckMapDatasetSource;
};

export function isDeckMapSqlDatasetSource(
  source: DeckMapDatasetSource | undefined,
): source is Pick<DeckSqlDatasetInput, 'sqlQuery'> {
  return Boolean(source && 'sqlQuery' in source);
}

export function isDeckMapTableDatasetSource(
  source: DeckMapDatasetSource | undefined,
): source is Pick<DeckTableDatasetInput, 'tableName' | 'transformSql'> {
  return Boolean(source && 'tableName' in source);
}

export type DeckMapInteractionConfig = {
  type: 'point-radius-brush';
  dataset: string;
  longitudeColumn: string;
  latitudeColumn: string;
  radiusMeters?: number;
  event?: 'hover' | 'click';
};

export type DeckMapFitToDataConfig = {
  dataset: string;
  longitudeColumn?: string;
  latitudeColumn?: string;
  geometryColumn?: string;
  h3Column?: string;
  padding?: number;
  maxZoom?: number;
};

export type DeckMapConfigMode = 'basic' | 'custom';

/** Durable, host-neutral Deck map configuration. */
export type DeckMapConfig = {
  spec: DeckJsonMapProps['spec'];
  datasets: Record<string, DeckMapDatasetConfig>;
  configMode?: DeckMapConfigMode;
  mapStyle?: string;
  mapProps?: Record<string, unknown>;
  showLegends?: boolean;
  interaction?: DeckMapInteractionConfig;
  fitToData?: DeckMapFitToDataConfig;
  dataPolicy?: DeckMapDataPolicyOverride;
  settingsOpen?: boolean;
};

export function createEmptyDeckMapConfig(): DeckMapConfig {
  return {
    spec: {
      initialViewState: {longitude: 0, latitude: 20, zoom: 1.5},
      layers: [],
    },
    datasets: {},
  };
}

/** Adapter-facing dashboard panel shape; worksheet resources never store it. */
export type DeckMapDashboardPanelConfig = DeckMapConfig;
export type DeckMapDashboardDatasetConfig = DeckMapDatasetConfig;
export type DeckMapDashboardDatasetSource = DeckMapDatasetSource;
export type DeckMapDashboardInteractionConfig = DeckMapInteractionConfig;
export type DeckMapDashboardFitToDataConfig = DeckMapFitToDataConfig;

export const isDeckMapDashboardSqlDatasetSource = isDeckMapSqlDatasetSource;
export const isDeckMapDashboardTableDatasetSource = isDeckMapTableDatasetSource;

export type CreateDeckMapDashboardPanelConfigOptions = DeckMapConfig & {
  title?: string;
};

/** Creates a Mosaic panel only for the opt-in dashboard adapter. */
export function createDeckMapDashboardPanelConfig(
  options: CreateDeckMapDashboardPanelConfigOptions,
) {
  const {title, ...config} = options;
  return {
    id: createId(),
    type: DECK_MAP_DASHBOARD_PANEL_TYPE,
    title: title ?? 'Map',
    config: JSON.parse(JSON.stringify(config)) as Record<string, unknown>,
  };
}

export function asDeckJsonMapConfig(
  config: Record<string, unknown>,
): DeckMapConfig | null {
  if (
    !config.spec ||
    !config.datasets ||
    typeof config.datasets !== 'object' ||
    Array.isArray(config.datasets)
  ) {
    return null;
  }
  return config as DeckMapConfig;
}
