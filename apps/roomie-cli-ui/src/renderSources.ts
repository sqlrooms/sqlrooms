import type {
  DataTable,
  DuckDbSliceState,
  QualifiedTableName,
} from '@sqlrooms/duckdb';
import {
  blockDocumentNodeToBlock,
  type BlockDocumentNode,
  type BlockDocumentBlock,
} from '@sqlrooms/documents';
import type {RoomState} from './RoomState';

/** Limit selectors to materialized local relations while retaining separate catalog metadata. */
export function isRoomieRenderTable(
  table: QualifiedTableName,
  metadata?: DataTable,
  currentDatabase = table.defaultDatabase,
): boolean {
  return (
    metadata?.isView === false &&
    [currentDatabase, 'temp'].includes(table.database ?? '') &&
    ![table.database, table.schema, table.table].some((part) =>
      part?.startsWith('__'),
    )
  );
}

/** Rendering cannot ask for per-query approval; only materialized local data is admitted. */
export function renderSourceError(
  db: Pick<DuckDbSliceState['db'], 'findTable' | 'currentDatabase'>,
  tableName?: string,
  {allowMissing = false}: {allowMissing?: boolean} = {},
): string | undefined {
  if (!tableName) return undefined;
  const table = db.findTable(tableName);
  if (!table && allowMissing) return undefined;
  if (!table || !isRoomieRenderTable(table.table, table, db.currentDatabase))
    return 'Charts and table explorers require a physical table in this workspace. Import or materialize the source first.';
}

/** Reject unresolved, external, internal, and view-backed analytical sources. */
export function validateRenderSource(
  db: Parameters<typeof renderSourceError>[0],
  tableName?: string,
  options?: Parameters<typeof renderSourceError>[2],
) {
  const error = renderSourceError(db, tableName, options);
  if (error) throw new Error(error);
}

/** Check block sources, including analytical nodes nested inside editorial content. */
export function validateBlockRenderSources(
  db: Parameters<typeof renderSourceError>[0],
  block: BlockDocumentBlock,
) {
  if (block.type === 'chart' || block.type === 'statefulBlock')
    validateRenderSource(db, block.tableName);
  if ('text' in block)
    for (const node of block.text) validateDocumentRenderSources(db, node);
  if (block.type === 'list')
    for (const item of block.items)
      for (const node of item) validateDocumentRenderSources(db, node);
}

function validateDocumentRenderSources(
  db: Parameters<typeof renderSourceError>[0],
  node: BlockDocumentNode,
  options?: Parameters<typeof renderSourceError>[2],
) {
  if (node.type.startsWith('blockDocument')) {
    const block = blockDocumentNodeToBlock(node);
    if (block && (block.type === 'chart' || block.type === 'statefulBlock'))
      validateRenderSource(db, block.tableName, options);
  }
  for (const child of node.content ?? [])
    validateDocumentRenderSources(db, child, options);
}

/** Reject disallowed saved sources; missing tables remain repairable in the UI. */
export async function validateWorkspaceRenderSources(
  state: Pick<RoomState, 'db' | 'blockDocuments' | 'mosaicDashboard'>,
) {
  const unresolved = new Set<string | QualifiedTableName>();
  const db: Parameters<typeof renderSourceError>[0] = {
    currentDatabase: state.db.currentDatabase,
    findTable: (name) => {
      const table = state.db.findTable(name);
      if (!table) unresolved.add(name);
      return table;
    },
  };
  for (const document of Object.values(state.blockDocuments.config.artifacts))
    for (const node of document.content.content)
      validateDocumentRenderSources(db, node, {allowMissing: true});
  for (const dashboard of Object.values(
    state.mosaicDashboard.config.dashboardsById,
  ))
    validateRenderSource(
      db,
      dashboard.selectedTable ?? dashboard.lastSelectedTable,
      {allowMissing: true},
    );
  // findTable uses the selectable-table list. A source hidden by that list
  // must not be mistaken for a dropped table during restoration.
  for (const name of unresolved) {
    if (await state.db.checkTableExists(name)) {
      throw new Error(
        'Saved analytical sources require a physical table in this workspace.',
      );
    }
  }
}
