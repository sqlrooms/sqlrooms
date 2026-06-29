import {
  getTableDisplayName,
  getTableIdentity,
  type DataTable,
} from '@sqlrooms/duckdb';
import {
  getRunContextItemIds,
  type AiRunContext,
  type AiRunContextItem,
} from '@sqlrooms/ai';
import type {ArtifactMetadataType} from '@sqlrooms/artifacts';
import {getOwningArtifactRunContextItems} from '@sqlrooms/artifacts/ai';
import type {RoomState} from '../store-types';
import type {StoreApi} from 'zustand';
import {CLI_ARTIFACT_TYPES} from '../artifactTypeIds';

const SUPPORTED_CONTEXT_ARTIFACT_TYPES = new Set<string>(CLI_ARTIFACT_TYPES);

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

function resolveContextItem(
  itemId: string,
  artifactsById: Record<string, ArtifactMetadataType>,
  tablesByQualifiedName: Map<string, TableInfo>,
): AiRunContextItem | undefined {
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
): AiRunContext | undefined {
  const state = store.getState();
  const {artifactsById} = state.artifacts.config;
  const {tables} = state.db;
  const session = state.ai.config.sessions.find(
    (candidate) => candidate.id === sessionId,
  );
  const tablesByQualifiedName = buildTablesMap(tables);

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
      resolveContextItem(itemId, artifactsById, tablesByQualifiedName),
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
