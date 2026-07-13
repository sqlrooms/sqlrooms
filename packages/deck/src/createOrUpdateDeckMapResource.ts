import type {DeckMapEntry} from './DeckMapsSlice';
import type {DeckMapConfig} from './mapConfig';
import {
  getFirstDatasetSourceTableName,
  hasSqlOnlyDatasetSource,
} from './datasetSourceUtils';

/**
 * Host callbacks used to coordinate a durable Deck map resource with its block
 * document container, table registry, and optional config preparation.
 */
export type CreateOrUpdateDeckMapResourceHost = {
  ensureBlockDocument: (blockDocumentId: string) => void;
  findMapBlock: (
    blockDocumentId: string,
    mapId: string,
  ) => {blockId: string; mapId: string; caption?: string} | undefined;
  findMap: (mapId: string) => DeckMapEntry | undefined;
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
  ensureMap: (mapId: string, title: string) => void;
  writeMap: (options: {
    mapId: string;
    title: string;
    config: DeckMapConfig;
    selectedTable?: string;
  }) => void | Promise<void>;
  findTable: (tableName: string) => {tableIdentity: string} | undefined;
  prepareConfig?: (options: {
    config: DeckMapConfig;
    existingMapConfig?: DeckMapConfig;
    tableName?: string;
  }) => DeckMapConfig | Promise<DeckMapConfig>;
};

/** Input for creating or updating a Deck map resource and its owning block. */
export type CreateOrUpdateDeckMapResourceParams = {
  blockDocumentId: string;
  config: DeckMapConfig;
  mapId?: string;
  tableName?: string;
  title?: string;
  caption?: string;
  intent?: string;
  height?: number;
  requireTableNameForSqlOnlyUpdate?: boolean;
  artifactLabel?: string;
  createMapId?: () => string;
  missingMapBlockBehavior?: 'throw' | 'create';
};

/** Result identities and resolved table selection from a map resource write. */
export type CreateOrUpdateDeckMapResourceResult = {
  blockDocumentId: string;
  blockId: string;
  mapId: string;
  selectedTable?: string;
  message: string;
  created: boolean;
};

/** Resource-native worksheet map orchestration with metadata-after-map-write ordering. */
export async function createOrUpdateDeckMapResource(
  host: CreateOrUpdateDeckMapResourceHost,
  params: CreateOrUpdateDeckMapResourceParams,
): Promise<CreateOrUpdateDeckMapResourceResult> {
  const artifactLabel = params.artifactLabel ?? 'block document';
  host.ensureBlockDocument(params.blockDocumentId);
  const existingBlock = params.mapId
    ? host.findMapBlock(params.blockDocumentId, params.mapId)
    : undefined;
  const missingBehavior = params.missingMapBlockBehavior ?? 'throw';
  if (params.mapId && !existingBlock && missingBehavior === 'throw') {
    throw new Error(
      `${artifactLabel} map block ${params.mapId} was not found in ${params.blockDocumentId}`,
    );
  }
  const mapId = existingBlock?.mapId ?? params.mapId ?? params.createMapId?.();
  if (!mapId) throw new Error('mapId is required when creating a map block');

  const existingMap = host.findMap(mapId);
  const requestedTable =
    params.tableName ?? getFirstDatasetSourceTableName(params.config);
  const preparedConfig = host.prepareConfig
    ? await host.prepareConfig({
        config: params.config,
        existingMapConfig: existingMap?.config,
        tableName: requestedTable,
      })
    : params.config;
  const tableName =
    requestedTable ?? getFirstDatasetSourceTableName(preparedConfig);
  if (
    (params.requireTableNameForSqlOnlyUpdate ?? true) &&
    existingBlock &&
    !tableName &&
    hasSqlOnlyDatasetSource(params.config)
  ) {
    throw new Error(
      `tableName is required when updating a ${artifactLabel} map block with SQL-only dataset sources.`,
    );
  }
  const table = tableName ? host.findTable(tableName) : undefined;
  if (tableName && !table)
    throw new Error(`Table "${tableName}" was not found.`);

  const caption =
    params.caption?.trim() ||
    params.title?.trim() ||
    existingBlock?.caption?.trim() ||
    existingMap?.title?.trim() ||
    'Map';
  const title = params.title?.trim() || caption;
  const created = !existingBlock;
  const block =
    existingBlock ??
    (await host.createMapBlock({
      blockDocumentId: params.blockDocumentId,
      mapId,
      title,
      caption,
      intent: params.intent,
      height: params.height,
    }));
  host.ensureMap(block.mapId, title);
  await host.writeMap({
    mapId: block.mapId,
    title,
    config: preparedConfig,
    selectedTable: table?.tableIdentity,
  });
  if (existingBlock) {
    await host.updateBlockMetadata({
      blockDocumentId: params.blockDocumentId,
      blockId: block.blockId,
      caption,
      intent: params.intent,
      height: params.height,
    });
  }
  return {
    blockDocumentId: params.blockDocumentId,
    blockId: block.blockId,
    mapId: block.mapId,
    selectedTable: table?.tableIdentity,
    created,
    message: created
      ? `Added ${artifactLabel} map block "${title}".`
      : `Updated ${artifactLabel} map block "${title}".`,
  };
}
