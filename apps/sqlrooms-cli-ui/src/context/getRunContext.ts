import {
  getAllTablesFromSchemaTrees,
  makeQualifiedTableName,
  type DbSchemaNode,
} from '@sqlrooms/duckdb';
import type {AiRunContext, AiRunContextItem} from '@sqlrooms/ai';
import type {ArtifactMetadata} from '@sqlrooms/artifacts';
import type {RoomState} from '../store-types';
import type {StoreApi} from 'zustand';

type TableInfo = {
  database?: string;
  schema?: string;
  table: string;
  isView: boolean;
};

function buildTablesMap(
  schemaTrees: DbSchemaNode[] | undefined,
): Map<string, TableInfo> {
  if (!schemaTrees) return new Map();

  const tablesByQualifiedName = new Map<string, TableInfo>();

  const allTables = getAllTablesFromSchemaTrees(schemaTrees);
  for (const tableObj of allTables) {
    const qualifiedName = makeQualifiedTableName({
      database: tableObj.table.database,
      schema: tableObj.table.schema,
      table: tableObj.table.table,
    }).toString();
    tablesByQualifiedName.set(qualifiedName, {
      database: tableObj.table.database,
      schema: tableObj.table.schema,
      table: tableObj.table.table,
      isView: tableObj.isView,
    });
  }

  return tablesByQualifiedName;
}

function createArtifactContextItem(
  artifact: ArtifactMetadata,
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
  artifactsById: Record<string, ArtifactMetadata>,
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
): AiRunContext | undefined {
  const state = store.getState();
  const {artifactsById} = state.artifacts.config;
  const {schemaTrees} = state.db;

  const tablesByQualifiedName = buildTablesMap(schemaTrees);

  const items = Array.from(new Set(state.aiContextItemIds))
    .map((itemId) =>
      resolveContextItem(itemId, artifactsById, tablesByQualifiedName),
    )
    .filter(Boolean) as AiRunContextItem[];

  if (items.length === 0) {
    return undefined;
  }

  return {
    items,
    primaryItemId: items[0]?.id,
    capturedAt: Date.now(),
  } satisfies AiRunContext;
}
