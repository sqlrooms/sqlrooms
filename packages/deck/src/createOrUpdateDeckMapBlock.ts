import {createDeckMapPanelFromNativeConfig} from './ai';
import type {DeckMapDashboardConfigToolConfig} from './ai';
import {
  DECK_MAP_DASHBOARD_PANEL_TYPE,
  type DeckMapDashboardPanelConfig,
} from './dashboardConfig';
import {
  getFirstDatasetSourceTableName,
  hasSqlOnlyDatasetSource,
} from './datasetSourceUtils';

type DeckMapPanel = ReturnType<typeof createDeckMapPanelFromNativeConfig>;

/**
 * Host callbacks for creating or updating a Deck map block inside a block
 * document. Apps adapt direct store mutations or command dispatch into this bag.
 */
export type CreateOrUpdateDeckMapBlockHost = {
  ensureBlockDocument: (blockDocumentId: string) => void;
  findMapBlock: (
    blockDocumentId: string,
    mapId: string,
  ) => {blockId: string; mapId: string} | undefined;
  findMapPanel: (
    mapId: string,
    panelId?: string,
  ) => {id: string; config?: unknown} | undefined;
  createMapBlock: (options: {
    blockDocumentId: string;
    mapId: string;
    title: string;
    caption?: string;
    intent?: string;
    height?: number;
  }) => Promise<{blockId: string; mapId: string}>;
  updateBlockMetadata: (options: {
    blockDocumentId: string;
    blockId: string;
    caption?: string;
    intent?: string;
    height?: number;
  }) => void | Promise<void>;
  ensureMapState: (mapId: string, title: string) => void;
  ensureDashboard: (mapId: string, title: string) => void;
  setSelectedTable?: (
    mapId: string,
    tableIdentity: string,
  ) => void | Promise<void>;
  addOrUpdateMapPanel: (options: {
    mapId: string;
    panel: DeckMapPanel;
    existingPanelId?: string;
  }) => void | Promise<void>;
  findTable: (tableName: string) => {tableIdentity: string} | undefined;
  /**
   * Optional host-side config transform before the panel is written
   * (for example FSQ patch-merge + color-scale heuristics + point normalize).
   */
  prepareConfig?: (options: {
    config: DeckMapDashboardConfigToolConfig;
    existingPanelConfig?: DeckMapDashboardPanelConfig;
    tableName?: string;
  }) =>
    | DeckMapDashboardConfigToolConfig
    | Promise<DeckMapDashboardConfigToolConfig>;
};

export type CreateOrUpdateDeckMapBlockParams = {
  blockDocumentId: string;
  config: DeckMapDashboardConfigToolConfig;
  mapId?: string;
  panelId?: string;
  tableName?: string;
  title?: string;
  caption?: string;
  intent?: string;
  height?: number;
  /**
   * When true (default), updating with SQL-only sources requires an explicit
   * `tableName` so selected-table state stays consistent.
   */
  requireTableNameForSqlOnlyUpdate?: boolean;
  /**
   * Product noun used in error/success messages.
   * Defaults to "block document".
   */
  artifactLabel?: string;
  /**
   * Generates a new map/block instance id when creating.
   * Required when `mapId` is omitted.
   */
  createMapId?: () => string;
  /**
   * When `mapId` is provided but no matching block exists:
   * - `'throw'` (default): fail, matching CLI command behavior
   * - `'create'`: create a new map block (FSQ AI tool behavior)
   */
  missingMapBlockBehavior?: 'throw' | 'create';
};

export type CreateOrUpdateDeckMapBlockResult = {
  blockDocumentId: string;
  blockId: string;
  mapId: string;
  panelId: string;
  selectedTable?: string;
  message: string;
  created: boolean;
};

/**
 * Shared create/update orchestration for Deck map blocks in block documents.
 * Hosts wrap this as an AI tool or command and supply mutation callbacks.
 */
export async function createOrUpdateDeckMapBlock(
  host: CreateOrUpdateDeckMapBlockHost,
  params: CreateOrUpdateDeckMapBlockParams,
): Promise<CreateOrUpdateDeckMapBlockResult> {
  const artifactLabel = params.artifactLabel ?? 'block document';
  const requireTableNameForSqlOnlyUpdate =
    params.requireTableNameForSqlOnlyUpdate ?? true;

  host.ensureBlockDocument(params.blockDocumentId);

  const existingMapBlock = params.mapId
    ? host.findMapBlock(params.blockDocumentId, params.mapId)
    : undefined;
  const missingMapBlockBehavior = params.missingMapBlockBehavior ?? 'throw';

  if (
    params.mapId &&
    !existingMapBlock &&
    missingMapBlockBehavior === 'throw'
  ) {
    throw new Error(
      `${artifactLabel} map block ${params.mapId} was not found in ${params.blockDocumentId}`,
    );
  }

  // On create: 'create' mode always generates a fresh id (FSQ); 'throw' mode
  // reuses params.mapId when provided (CLI).
  const mapId =
    existingMapBlock?.mapId ??
    (missingMapBlockBehavior === 'create'
      ? params.createMapId?.()
      : (params.mapId ?? params.createMapId?.()));
  if (!mapId) {
    throw new Error('mapId is required when creating a map block');
  }

  const existingPanel = host.findMapPanel(mapId, params.panelId);
  if (params.panelId && !existingPanel) {
    throw new Error(`Map panel ${params.panelId} was not found`);
  }

  const requestedTableName =
    params.tableName ?? getFirstDatasetSourceTableName(params.config);
  const existingConfig = existingPanel?.config as
    | DeckMapDashboardPanelConfig
    | undefined;
  const preparedConfig = host.prepareConfig
    ? await host.prepareConfig({
        config: params.config,
        existingPanelConfig: existingConfig,
        tableName: requestedTableName,
      })
    : params.config;

  const tableName =
    requestedTableName ?? getFirstDatasetSourceTableName(preparedConfig);

  if (
    requireTableNameForSqlOnlyUpdate &&
    params.mapId &&
    !tableName &&
    hasSqlOnlyDatasetSource(params.config)
  ) {
    throw new Error(
      `tableName is required when updating a ${artifactLabel} map block with SQL-only dataset sources.`,
    );
  }

  const table = tableName ? host.findTable(tableName) : undefined;
  if (requestedTableName && !table) {
    throw new Error(`Table "${tableName}" was not found.`);
  }
  const tableIdentity = table?.tableIdentity;

  const title = params.title?.trim() || 'Map';
  const caption = params.caption ?? title;
  const created = !existingMapBlock;

  let blockId: string;
  let resolvedMapId: string;

  if (existingMapBlock) {
    blockId = existingMapBlock.blockId;
    resolvedMapId = existingMapBlock.mapId;
    host.ensureMapState(resolvedMapId, title);
    host.ensureDashboard(resolvedMapId, title);
    await host.updateBlockMetadata({
      blockDocumentId: params.blockDocumentId,
      blockId,
      caption,
      intent: params.intent,
      height: params.height,
    });
  } else {
    const createdBlock = await host.createMapBlock({
      blockDocumentId: params.blockDocumentId,
      mapId,
      title,
      caption,
      intent: params.intent,
      height: params.height,
    });
    blockId = createdBlock.blockId;
    resolvedMapId = createdBlock.mapId;
    host.ensureMapState(resolvedMapId, title);
    host.ensureDashboard(resolvedMapId, title);
  }

  if (tableIdentity && host.setSelectedTable) {
    await host.setSelectedTable(resolvedMapId, tableIdentity);
  }

  const panel = createDeckMapPanelFromNativeConfig({
    title,
    config: preparedConfig,
  });

  const panelAfterEnsure = host.findMapPanel(resolvedMapId, params.panelId);
  const existingPanelId = panelAfterEnsure?.id ?? existingPanel?.id;

  await host.addOrUpdateMapPanel({
    mapId: resolvedMapId,
    panel,
    existingPanelId,
  });

  return {
    blockDocumentId: params.blockDocumentId,
    blockId,
    mapId: resolvedMapId,
    panelId: existingPanelId ?? panel.id,
    selectedTable: tableIdentity,
    created,
    message: created
      ? `Added ${artifactLabel} map block "${title}".`
      : `Updated ${artifactLabel} map block "${title}".`,
  };
}

export {DECK_MAP_DASHBOARD_PANEL_TYPE};
