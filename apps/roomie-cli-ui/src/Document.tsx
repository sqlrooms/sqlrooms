import {Selection} from '@uwdata/mosaic-core';
import {restoreSelection, synchronizeTableSelection} from './tableSelection';
import {useEffect, useMemo, useRef, useState} from 'react';
import {
  BlockDocumentArtifact,
  BlockDocumentChartRendererProvider,
  BlockDocumentStatefulBlockRendererProvider,
  BlockSettingsPanelLayout,
  type Editor,
  type BlockDocumentStatefulBlockRendererProps,
  type BlockDocumentChartRendererProps,
  blockDocumentBlockToNode,
  blockDocumentContentToBlocks,
} from '@sqlrooms/documents';
import {
  ChartBlockRenderer,
  ChartBlockSettings,
  DataTableBlockRenderer,
  MosaicDashboard,
  DataTableExplorer,
  useDataTableExplorer,
} from '@sqlrooms/mosaic';
import {HtmlAppBlock} from '@sqlrooms/app-runtime';
import {useDataTable} from '@sqlrooms/db';
import {roomStore, useRoomStore} from './store';
import {STATEFUL_BLOCKS, TableSettings} from './model';
import {ensureBlock} from './commands';
import {assertLocalRenderQuery} from './renderQueryPolicy';
import type {QueryRequestType} from '@sqlrooms/app-runtime';
import {renderSourceError} from './renderSources';

const authorizeHtmlQuery = (request: QueryRequestType) =>
  assertLocalRenderQuery(roomStore.getState().db, request.sql);

function useRenderSourceError(tableName?: string) {
  return useRoomStore((state) => renderSourceError(state.db, tableName));
}

function ChartBlock(props: BlockDocumentChartRendererProps) {
  const error = useRenderSourceError(props.tableName);
  return error ? (
    <p role="alert" className="p-4 text-sm">
      {error}
    </p>
  ) : (
    <ChartBlockRenderer {...props} />
  );
}

function TableBlock(props: BlockDocumentStatefulBlockRendererProps) {
  const error = useRenderSourceError(props.tableName);
  const table = useDataTable(props.tableName);
  if (error)
    return (
      <p role="alert" className="p-4 text-sm">
        {error}
      </p>
    );
  if (!table || !props.blockInstanceId)
    return <DataTableBlockRenderer {...props} />;
  return (
    <PersistedTable {...props} table={table.table} id={props.blockInstanceId} />
  );
}
function PersistedTable({
  table,
  id,
  caption,
}: BlockDocumentStatefulBlockRendererProps & {
  table: NonNullable<ReturnType<typeof useDataTable>>['table'];
  id: string;
}) {
  const stored = useRoomStore((s) => s.tableExplorers.config.byId[id]);
  const settings = useMemo(() => TableSettings.parse(stored ?? {}), [stored]);
  const [selection] = useState(() => {
    const result = Selection.crossfilter();
    restoreSelection(result, settings.filters);
    return result;
  });
  const settingsRef = useRef(settings);
  const selectionSync = useRef<ReturnType<
    typeof synchronizeTableSelection
  > | null>(null);
  settingsRef.current = settings;
  const explorer = useDataTableExplorer({
    tableName: table,
    columns: settings.columns,
    initialSorting: settings.sorting,
    pageSize: settings.pageSize,
    selection,
  });
  useEffect(() => {
    explorer.setSorting(settings.sorting);
  }, [settings.sorting, explorer.setSorting]);
  useEffect(() => {
    const sync = synchronizeTableSelection(selection, (filters) => {
      if (
        JSON.stringify(filters) !== JSON.stringify(settingsRef.current.filters)
      )
        roomStore
          .getState()
          .tableExplorers.update(id, {...settingsRef.current, filters});
    });
    selectionSync.current = sync;
    return () => {
      sync.dispose();
      selectionSync.current = null;
    };
  }, [selection, id]);
  useEffect(() => {
    selectionSync.current?.restore(settings.filters);
  }, [selection, settings.filters]);
  const controlledExplorer = {
    ...explorer,
    setSorting: (next: Parameters<typeof explorer.setSorting>[0]) => {
      const sorting =
        typeof next === 'function' ? next(explorer.sorting) : next;
      explorer.setSorting(sorting);
      roomStore
        .getState()
        .tableExplorers.update(id, {...settingsRef.current, sorting});
    },
  };
  return (
    <DataTableExplorer.Root explorer={controlledExplorer}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="border-b p-2 text-sm">
          {caption ?? 'Data table'}
          {settings.filters.length > 0 && (
            <span className="ml-3 text-xs text-slate-500">
              {settings.filters.length} saved filter(s) · Reset to clear
            </span>
          )}
          <DataTableExplorer.ResetButton aria-label="Reset table filters" />
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <DataTableExplorer.Table>
            <DataTableExplorer.Header />
            <DataTableExplorer.Rows />
          </DataTableExplorer.Table>
        </div>
        <DataTableExplorer.StatusBar />
      </div>
    </DataTableExplorer.Root>
  );
}
function HtmlBlock({blockInstanceId}: BlockDocumentStatefulBlockRendererProps) {
  const title = useRoomStore((state) =>
    blockInstanceId
      ? state.htmlApps.config.appsById[blockInstanceId]?.title
      : undefined,
  );
  return (
    <HtmlAppBlock
      blockId={blockInstanceId}
      title={title}
      authorizeQuery={authorizeHtmlQuery}
      className="h-full min-h-80"
    />
  );
}

function DashboardBlock({
  blockInstanceId,
  readOnly,
}: BlockDocumentStatefulBlockRendererProps) {
  const tableName = useRoomStore((state) =>
    blockInstanceId
      ? (state.mosaicDashboard.config.dashboardsById[blockInstanceId]
          ?.selectedTable ??
        state.mosaicDashboard.config.dashboardsById[blockInstanceId]
          ?.lastSelectedTable)
      : undefined,
  );
  const error = useRenderSourceError(tableName);
  if (error)
    return (
      <p role="alert" className="p-4 text-sm">
        {error}
      </p>
    );
  return blockInstanceId ? (
    <MosaicDashboard
      dashboardId={blockInstanceId}
      defaultLayoutType="grid"
      selectable
      readOnly={readOnly}
    />
  ) : null;
}

const renderers = {
  'data-table': TableBlock,
  dashboard: DashboardBlock,
  'html-app': HtmlBlock,
};
const blockTypes = STATEFUL_BLOCKS.map((blockType) => ({
  blockType,
  label:
    blockType === 'data-table'
      ? 'Data table'
      : blockType === 'html-app'
        ? 'HTML app'
        : 'Dashboard',
  defaultHeight: 520,
  resizableHeight: true,
  createNode: (blockId: string) => {
    ensureBlock(roomStore.getState(), blockType, blockId);
    return blockDocumentBlockToNode({
      id: blockId,
      type: 'statefulBlock',
      blockType,
      blockInstanceId: blockId,
      ownership: 'owned',
      height: 520,
    });
  },
}));

/** Document composition with exactly the supported analytical renderers. */
export function Document({id}: {id: string}) {
  const artifact = useRoomStore((s) => s.artifacts.config.artifactsById[id]);
  const [editor, setEditor] = useState<Editor | null>(null);
  if (!artifact) return null;
  return (
    <BlockDocumentChartRendererProvider
      renderer={ChartBlock}
      settings={ChartBlockSettings}
    >
      <BlockDocumentStatefulBlockRendererProvider
        renderers={renderers}
        blockTypes={blockTypes}
      >
        <BlockSettingsPanelLayout editor={editor} documentId={id}>
          <BlockDocumentArtifact
            artifactId={id}
            title={artifact.title}
            onTitleChange={(title) =>
              roomStore.getState().artifacts.renameArtifact(id, title)
            }
            onEditorReady={setEditor}
          />
        </BlockSettingsPanelLayout>
      </BlockDocumentStatefulBlockRendererProvider>
    </BlockDocumentChartRendererProvider>
  );
}

/** Read the current document's block DTOs for visible editing and read-back. */
export function documentBlocks(id: string) {
  const document = roomStore.getState().blockDocuments.config.artifacts[id];
  return document ? blockDocumentContentToBlocks(document.content) : [];
}
