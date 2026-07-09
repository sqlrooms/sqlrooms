import {
  getTableDisplayName,
  getTableIdentity,
  type DataTable,
} from '@sqlrooms/duckdb';
import {
  createBlockContextItem,
  getRunContextItemIds,
  type AiRunContext,
  type AiRunContextItem,
} from '@sqlrooms/ai';
import type {ArtifactMetadataType} from '@sqlrooms/artifacts';
import {getOwningArtifactRunContextItems} from '@sqlrooms/artifacts/ai';
import {
  blockDocumentNodeToBlock,
  defaultBlockTitle,
  parseBlockContextItemId,
} from '@sqlrooms/documents';
import type {RoomState} from '../store-types';
import type {StoreApi} from 'zustand';
import {CLI_AI_BLOCK_TYPES, CLI_ARTIFACT_TYPES} from '../artifactTypeIds';
import {
  getEnabledStatefulBlockArtifactTypes,
  getStatefulBlockArtifactConfig,
  isStatefulBlockArtifactType,
} from '../statefulBlockArtifactConfigs';

const SUPPORTED_CONTEXT_ARTIFACT_TYPES = new Set<string>(CLI_ARTIFACT_TYPES);
const CLI_BLOCK_CONTEXT_TYPES = new Set<string>(CLI_AI_BLOCK_TYPES);

type TableInfo = {
  database?: string;
  schema?: string;
  table: string;
  isView: boolean;
};

function buildTablesMap(
  tables: DataTable[] | undefined,
): Map<string, TableInfo> {
  const tablesByQualifiedName = new Map<string, TableInfo>();

  for (const tableObj of tables ?? []) {
    tablesByQualifiedName.set(getTableIdentity(tableObj.table), {
      database: tableObj.table.database,
      schema: tableObj.table.schema,
      table: getTableDisplayName(tableObj.table),
      isView: tableObj.isView,
    });
  }

  return tablesByQualifiedName;
}

function createArtifactContextItem(
  artifact: ArtifactMetadataType,
): AiRunContextItem {
  return {
    kind: 'artifact',
    id: artifact.id,
    type: artifact.type,
    title: artifact.title,
  };
}

function createTableContextItem(
  itemId: string,
  table: TableInfo,
): AiRunContextItem {
  return {
    kind: 'table',
    id: itemId,
    type: table.isView ? 'view' : 'table',
    title: table.table,
    subtitle: `${table.database}.${table.schema}`,
  };
}

function getBlockContextTitle(
  block: ReturnType<typeof blockDocumentNodeToBlock>,
) {
  if (!block) return undefined;
  if (block.type === 'chart') return block.caption;
  if (block.type === 'statefulBlock') return block.caption;
  return undefined;
}

function resolveCliBlockLabel(blockType: string): string | undefined {
  if (blockType === 'chart') return 'Chart';
  return isStatefulBlockArtifactType(blockType)
    ? getStatefulBlockArtifactConfig(blockType).label
    : undefined;
}

function resolveBlockContextItem(
  itemId: string,
  state: RoomState,
  enabledCliBlockContextTypes: ReadonlySet<string>,
): AiRunContextItem | undefined {
  const parsedId = parseBlockContextItemId(itemId);
  if (!parsedId) return undefined;

  const artifact =
    state.artifacts.config.artifactsById[parsedId.blockDocumentId];
  const blockDocument =
    state.blockDocuments.config.artifacts[parsedId.blockDocumentId];
  const block = blockDocument?.content.content.reduce<
    ReturnType<typeof blockDocumentNodeToBlock> | undefined
  >((matchedBlock, candidate) => {
    if (matchedBlock) return matchedBlock;
    const candidateBlock = blockDocumentNodeToBlock(candidate);
    return candidateBlock?.id === parsedId.blockId ? candidateBlock : undefined;
  }, undefined);
  if (!block) return undefined;

  const target =
    block.type === 'chart'
      ? {
          blockType: 'chart',
          blockInstanceId: undefined,
          title: getBlockContextTitle(block),
        }
      : block.type === 'statefulBlock'
        ? {
            blockType: block.blockType,
            blockInstanceId: block.blockInstanceId,
            title: getBlockContextTitle(block),
          }
        : undefined;

  if (!target || !enabledCliBlockContextTypes.has(target.blockType)) {
    return undefined;
  }

  return createBlockContextItem({
    id: itemId,
    blockDocumentId: parsedId.blockDocumentId,
    blockId: parsedId.blockId,
    blockType: target.blockType,
    blockInstanceId: target.blockInstanceId,
    panelId: parsedId.panelId,
    title: defaultBlockTitle(target.blockType, {
      title: target.title,
      resolveLabel: resolveCliBlockLabel,
    }),
    subtitle: artifact?.title,
  });
}

function resolveContextItem(
  itemId: string,
  state: RoomState,
  artifactsById: Record<string, ArtifactMetadataType>,
  tablesByQualifiedName: Map<string, TableInfo>,
  enabledCliBlockContextTypes: ReadonlySet<string>,
): AiRunContextItem | undefined {
  const blockItem = resolveBlockContextItem(
    itemId,
    state,
    enabledCliBlockContextTypes,
  );
  if (blockItem) {
    return blockItem;
  }

  // Check if it's an artifact
  const artifact = artifactsById[itemId];
  if (artifact) {
    return createArtifactContextItem(artifact);
  }

  // Check if it's a table
  const table = tablesByQualifiedName.get(itemId);
  if (table) {
    return createTableContextItem(itemId, table);
  }

  return undefined;
}

export function getRunContext(
  store: StoreApi<RoomState>,
  sessionId: string,
  {
    experimentalEnabled = false,
  }: {
    experimentalEnabled?: boolean;
  } = {},
): AiRunContext | undefined {
  const state = store.getState();
  const {artifactsById} = state.artifacts.config;
  const {tables} = state.db;
  const session = state.ai.config.sessions.find(
    (candidate) => candidate.id === sessionId,
  );
  const tablesByQualifiedName = buildTablesMap(tables);
  const enabledCliBlockContextTypes = new Set<string>([
    'chart',
    ...getEnabledStatefulBlockArtifactTypes(experimentalEnabled).filter(
      (type) => CLI_BLOCK_CONTEXT_TYPES.has(type),
    ),
  ]);

  if (
    session?.draftContextItemIds === undefined &&
    session?.runContext &&
    getRunContextItemIds(session.runContext).length > 0
  ) {
    return session.runContext;
  }

  const explicitContextItemIds = session?.draftContextItemIds ?? [];
  const extraItems = Array.from(new Set(explicitContextItemIds))
    .map((itemId) =>
      resolveContextItem(
        itemId,
        state,
        artifactsById,
        tablesByQualifiedName,
        enabledCliBlockContextTypes,
      ),
    )
    .filter(Boolean) as AiRunContextItem[];
  const items = getOwningArtifactRunContextItems({
    sessionId,
    aiSessionArtifacts: state.artifactAi.config.aiSessionArtifacts,
    artifactsById,
    extraItems,
    isSupportedArtifactType: (artifactType) =>
      SUPPORTED_CONTEXT_ARTIFACT_TYPES.has(artifactType),
  });

  if (items.length === 0) {
    return undefined;
  }

  return {
    items,
    primaryItemId: items[0]?.id,
    capturedAt: Date.now(),
  } satisfies AiRunContext;
}
