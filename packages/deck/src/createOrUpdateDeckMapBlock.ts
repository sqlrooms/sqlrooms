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
 * Transitional host callbacks for the current Mosaic-dashboard-backed
 * worksheet-map representation. Apps adapt direct store mutations or command
 * dispatch into this bag.
 *
 * The dashboard/panel callbacks, `panelId`, and dashboard ownership implied by
 * this shape are implementation details of the current representation, not the
 * long-term Deck map resource API.
 */
export type CreateOrUpdateDeckMapBlockHost = {
  ensureBlockDocument: (blockDocumentId: string) => void;
  /** Find an existing map block, including its user-facing caption. */
  findMapBlock: (
    blockDocumentId: string,
    mapId: string,
  ) => {blockId: string; mapId: string; caption?: string} | undefined;
  findMapPanel: (
    mapId: string,
    panelId?: string,
  ) => {id: string; title?: string; config?: unknown} | undefined;
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
  /**
   * Ensure the backing mosaic dashboard exists. Pass `undefined` title to
   * avoid renaming an existing dashboard during title-less updates.
   */
  ensureDashboard: (mapId: string, title?: string) => void;
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
  /**
   * When `panelId` is provided but no matching panel exists:
   * - `'throw'` (default): fail, matching CLI command behavior
   * - `'create'`: ignore the stale id and add a new panel (FSQ AI tool behavior)
   */
  missingPanelBehavior?: 'throw' | 'create';
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
 * Orchestrates create/update behavior for the current Mosaic-dashboard-backed
 * worksheet-map representation. Hosts wrap this as an AI tool or command and
 * supply the transitional dashboard/panel mutation callbacks above.
 *
 * Consumers should not treat `panelId` or dashboard ownership as the long-term
 * Deck map resource contract. The resource-native replacement should retain
 * this helper's behavioral guarantees: strict target/table validation,
 * title-preserving updates, and persisting block metadata only after the map
 * write succeeds.
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

  const missingPanelBehavior = params.missingPanelBehavior ?? 'throw';
  const existingPanel = host.findMapPanel(mapId, params.panelId);
  if (params.panelId && !existingPanel && missingPanelBehavior === 'throw') {
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
    existingMapBlock &&
    !tableName &&
    hasSqlOnlyDatasetSource(params.config)
  ) {
    throw new Error(
      `tableName is required when updating a ${artifactLabel} map block with SQL-only dataset sources.`,
    );
  }

  const table = tableName ? host.findTable(tableName) : undefined;
  if (tableName && !table) {
    throw new Error(`Table "${tableName}" was not found.`);
  }
  const tableIdentity = table?.tableIdentity;

  // The block caption is the user-facing map label and therefore the source
  // of truth for title-less updates. UI-created blocks may have an empty
  // caption, so preserve the existing panel title before falling back to Map.
  const existingCaption = existingMapBlock?.caption?.trim() || undefined;
  const existingPanelTitle = existingPanel?.title?.trim() || undefined;
  const caption =
    params.caption ??
    params.title?.trim() ??
    existingCaption ??
    existingPanelTitle ??
    'Map';
  const title = params.title?.trim() || caption;
  const created = !existingMapBlock;
  const hasExplicitTitle = Boolean(params.title?.trim());
  const dashboardTitle = created || hasExplicitTitle ? title : undefined;

  let blockId: string;
  let resolvedMapId: string;

  if (existingMapBlock) {
    blockId = existingMapBlock.blockId;
    resolvedMapId = existingMapBlock.mapId;
    host.ensureMapState(resolvedMapId, title);
    host.ensureDashboard(resolvedMapId, dashboardTitle);
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
    host.ensureDashboard(resolvedMapId, dashboardTitle);
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

  // Persist metadata only after the panel write succeeds so failed updates do
  // not leave the block caption, intent, or height out of sync with the map.
  if (existingMapBlock) {
    await host.updateBlockMetadata({
      blockDocumentId: params.blockDocumentId,
      blockId,
      caption,
      intent: params.intent,
      height: params.height,
    });
  }

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
