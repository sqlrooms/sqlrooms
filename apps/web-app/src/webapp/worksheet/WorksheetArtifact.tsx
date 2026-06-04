import {
  BlockDocumentArtifact,
  BlockDocumentChartRendererProvider,
  BlockDocumentStatefulBlockRendererProvider,
  type BlockDocumentChartRenderer,
  type BlockDocumentContent,
  type BlockDocumentStatefulBlockRenderer,
  type BlockDocumentStatefulBlockRendererProps,
} from '@sqlrooms/documents';
import type {RoomPanelComponent} from '@sqlrooms/layout';
import {
  ChartConfig,
  DataTableBlockRenderer,
  MosaicChartSettingsPanel,
  MosaicChartView,
  MosaicDashboard,
  MosaicDashboardPanelLayout,
  useDataTable,
  useTablesWithColumns,
  type MosaicDashboardSliceConfig,
} from '@sqlrooms/mosaic';
import {useBaseRoomStore, useRoomStoreApi} from '@sqlrooms/room-store';
import {SQL_QUERY_BLOCK_TYPE, SqlQueryBlock} from '@sqlrooms/sql-editor';
import type {SqlEditorSliceConfig} from '@sqlrooms/sql-editor-config';
import {Button, cn} from '@sqlrooms/ui';
import {Settings2Icon} from 'lucide-react';
import {useCallback, useEffect, useMemo, useRef} from 'react';
import type {WorkspaceRoomState} from '../workspace/WorkspaceRoomStore';
import {
  createEmptyPersistedSqlEditorConfig,
  createWorksheetStatefulBlockTypes,
  getOwnedStatefulBlockIds,
  serializeWorksheetContent,
} from './worksheetState';

type ChartConfigType = ReturnType<typeof ChartConfig.parse>;

export const WorksheetArtifactPanel: RoomPanelComponent = ({panelId, meta}) => {
  const artifactId = (meta?.artifactId as string) ?? panelId;
  const artifact = useBaseRoomStore<WorkspaceRoomState, {title: string} | null>(
    (state) => {
      const candidate = state.artifacts.getArtifact(artifactId);
      return candidate?.type === 'worksheet' ? {title: candidate.title} : null;
    },
  );
  const renameArtifact = useBaseRoomStore<
    WorkspaceRoomState,
    WorkspaceRoomState['artifacts']['renameArtifact']
  >((state) => state.artifacts.renameArtifact);

  const handleTitleChange = useCallback(
    (title: string) => {
      renameArtifact(artifactId, title);
    },
    [artifactId, renameArtifact],
  );

  if (!artifact) return null;

  return (
    <div className="worksheet-document-surface">
      <WorksheetBlockDocument
        worksheetId={artifactId}
        title={artifact.title}
        onTitleChange={handleTitleChange}
      />
    </div>
  );
};

export function WorksheetBlockDocument({
  title,
  worksheetId,
  onTitleChange,
}: {
  title: string;
  worksheetId: string;
  onTitleChange: (title: string) => void;
}) {
  const roomStore = useRoomStoreApi<WorkspaceRoomState>();
  const blockTypes = useMemo(
    () => createWorksheetStatefulBlockTypes({getState: roomStore.getState}),
    [roomStore],
  );

  return (
    <BlockDocumentChartRendererProvider renderer={WorksheetChartRenderer}>
      <BlockDocumentStatefulBlockRendererProvider
        blockTypes={blockTypes}
        renderers={WORKSHEET_STATEFUL_BLOCK_RENDERERS}
      >
        <BlockDocumentArtifact
          artifactId={worksheetId}
          title={title}
          onTitleChange={onTitleChange}
        />
      </BlockDocumentStatefulBlockRendererProvider>
    </BlockDocumentChartRendererProvider>
  );
}

export function useSerializedWorksheetContent(worksheetId: string) {
  const content = useBaseRoomStore<WorkspaceRoomState, BlockDocumentContent>(
    (state) =>
      state.blockDocuments.config.artifacts[worksheetId]?.content ?? {
        type: 'doc',
        content: [],
      },
  );
  const sqlEditorConfig = useBaseRoomStore<
    WorkspaceRoomState,
    SqlEditorSliceConfig
  >((state) => state.sqlEditor.config);
  const mosaicDashboardConfig = useBaseRoomStore<
    WorkspaceRoomState,
    MosaicDashboardSliceConfig
  >((state) => state.mosaicDashboard.config);

  return useMemo(() => {
    const ownedBlockIds = getOwnedStatefulBlockIds(content);

    return serializeWorksheetContent(content, {
      sqlEditor: {
        ...createEmptyPersistedSqlEditorConfig(),
        queries: sqlEditorConfig.queries.filter((query) =>
          ownedBlockIds.has(query.id),
        ),
        selectedQueryId: ownedBlockIds.has(sqlEditorConfig.selectedQueryId)
          ? sqlEditorConfig.selectedQueryId
          : '',
        openTabs: sqlEditorConfig.openTabs.filter((queryId) =>
          ownedBlockIds.has(queryId),
        ),
        lastExecutedQuery: sqlEditorConfig.lastExecutedQuery,
      },
      mosaicDashboard: {
        dashboardsById: Object.fromEntries(
          Object.entries(mosaicDashboardConfig.dashboardsById).filter(
            ([dashboardId]) => ownedBlockIds.has(dashboardId),
          ),
        ),
      },
    });
  }, [content, mosaicDashboardConfig, sqlEditorConfig]);
}

export function useRefreshWorksheetDbSchemas(tableNames: string[]) {
  const refreshTableSchemas = useBaseRoomStore<
    WorkspaceRoomState,
    WorkspaceRoomState['db']['refreshTableSchemas']
  >((state) => state.db.refreshTableSchemas);
  const tableNamesKey = tableNames.join('\0');

  useEffect(() => {
    void refreshTableSchemas();
  }, [refreshTableSchemas, tableNamesKey]);
}

function normalizeStatefulBlockOwnership(ownership: string | undefined) {
  return ownership === 'owned' ||
    ownership === 'shared' ||
    ownership === 'external'
    ? ownership
    : undefined;
}

const WorksheetDataTableBlockRenderer = (
  props: BlockDocumentStatefulBlockRendererProps,
) => {
  const updateBlock = useBaseRoomStore<
    WorkspaceRoomState,
    WorkspaceRoomState['blockDocuments']['updateBlock']
  >((state) => state.blockDocuments.updateBlock);

  const handleTitleChange = useCallback(
    (title: string | undefined) => {
      if (props.onTitleChange) {
        props.onTitleChange(title);
        return;
      }

      updateBlock(props.documentId, props.blockId, {
        id: props.blockId,
        type: 'statefulBlock',
        blockType: props.blockType,
        blockInstanceId: props.blockInstanceId,
        ownership: normalizeStatefulBlockOwnership(props.ownership),
        title: title || undefined,
        caption: props.caption,
        height: props.height,
      });
    },
    [
      props.blockId,
      props.blockInstanceId,
      props.blockType,
      props.caption,
      props.documentId,
      props.height,
      props.onTitleChange,
      props.ownership,
      updateBlock,
    ],
  );

  return (
    <DataTableBlockRenderer {...props} onTitleChange={handleTitleChange} />
  );
};

const WorksheetDashboardBlockRenderer = ({
  blockInstanceId,
  blockType,
  title,
  caption,
}: BlockDocumentStatefulBlockRendererProps) => {
  const ensureDashboard = useBaseRoomStore<
    WorkspaceRoomState,
    WorkspaceRoomState['mosaicDashboard']['ensureDashboard']
  >((state) => state.mosaicDashboard.ensureDashboard);

  useEffect(() => {
    if (blockType === 'dashboard' && blockInstanceId) {
      ensureDashboard(blockInstanceId, title ?? 'Embedded Dashboard', 'grid');
    }
  }, [blockInstanceId, blockType, ensureDashboard, title]);

  if (!blockInstanceId || blockType !== 'dashboard') {
    return <UnsupportedStatefulBlock blockType={blockType} />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {caption ? (
        <div className="border-border shrink-0 border-b px-3 py-2 text-sm font-medium">
          {caption}
        </div>
      ) : null}
      <div className="min-h-0 flex-1">
        <MosaicDashboard dashboardId={blockInstanceId} />
      </div>
    </div>
  );
};

const WorksheetSqlQueryBlockRenderer = ({
  blockInstanceId,
  blockType,
  title,
  readOnly,
}: BlockDocumentStatefulBlockRendererProps) => {
  if (!blockInstanceId || blockType !== SQL_QUERY_BLOCK_TYPE) {
    return <UnsupportedStatefulBlock blockType={blockType} />;
  }

  return (
    <SqlQueryBlock
      queryId={blockInstanceId}
      title={title ?? 'SQL Query'}
      readOnly={readOnly}
      compact
    />
  );
};

const WORKSHEET_STATEFUL_BLOCK_RENDERERS = {
  dashboard: WorksheetDashboardBlockRenderer,
  'data-table': WorksheetDataTableBlockRenderer,
  [SQL_QUERY_BLOCK_TYPE]: WorksheetSqlQueryBlockRenderer,
} satisfies Record<string, BlockDocumentStatefulBlockRenderer>;

function UnsupportedStatefulBlock({blockType}: {blockType: string}) {
  return (
    <div className="text-muted-foreground p-4 text-sm">
      Unsupported stateful block type: {blockType || 'Unconfigured'}
    </div>
  );
}

function getBlockDocumentChartSelectionName({
  documentId,
  blockId,
  selectionGroupId,
}: Pick<
  Parameters<BlockDocumentChartRenderer>[0],
  'documentId' | 'blockId' | 'selectionGroupId'
>) {
  return selectionGroupId
    ? `worksheet:${documentId}:chart-group:${selectionGroupId}:brush`
    : `worksheet:${documentId}:chart-block:${blockId}:brush`;
}

function getBlockDocumentChartRuntimeKey({
  documentId,
  blockId,
}: Pick<Parameters<BlockDocumentChartRenderer>[0], 'documentId' | 'blockId'>) {
  return `worksheet:${documentId}:chart-block:${blockId}`;
}

function stableStringify(value: unknown) {
  return JSON.stringify(normalizeForStableStringify(value));
}

function normalizeForStableStringify(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeForStableStringify);
  }
  if (
    value &&
    typeof value === 'object' &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [
          key,
          normalizeForStableStringify((value as Record<string, unknown>)[key]),
        ]),
    );
  }
  return value;
}

const WorksheetChartRenderer: BlockDocumentChartRenderer = ({
  documentId,
  blockId,
  tableName,
  config,
  selectionGroupId,
  caption,
  readOnly,
  onTableNameChange,
  onConfigChange,
  onCaptionChange,
}) => {
  const onTableNameChangeRef = useRef(onTableNameChange);
  const onConfigChangeRef = useRef(onConfigChange);

  useEffect(() => {
    onTableNameChangeRef.current = onTableNameChange;
  }, [onTableNameChange]);

  useEffect(() => {
    onConfigChangeRef.current = onConfigChange;
  }, [onConfigChange]);

  const tables = useTablesWithColumns();
  const fallbackTable = tables[0];
  const fallbackField = fallbackTable?.columns?.[0]?.name;
  const effectiveTableName = tableName || fallbackTable?.table.table || '';
  const defaultConfig = useMemo<ChartConfigType>(() => {
    return {
      chartType: 'count-plot',
      settings: fallbackField ? {field: fallbackField} : {},
      settingsOpen: true,
    };
  }, [fallbackField]);
  const parsedConfig = useMemo(
    () => parseWorksheetChartConfig(config, defaultConfig),
    [config, defaultConfig],
  );
  const configKey = stableStringify(config);
  const chartConfig = parsedConfig.success ? parsedConfig.config : undefined;
  const selectionName = getBlockDocumentChartSelectionName({
    documentId,
    blockId,
    selectionGroupId,
  });
  const runtimeKey = getBlockDocumentChartRuntimeKey({documentId, blockId});
  const dataTable = useDataTable(effectiveTableName);

  const handleSettingsOpenChange = useCallback(
    (settingsOpen: boolean) => {
      if (!chartConfig) return;
      onConfigChange?.({...chartConfig, settingsOpen});
    },
    [chartConfig, onConfigChange],
  );

  const handleConfigChange = useCallback(
    (nextConfig: ChartConfigType) => {
      onConfigChange?.(nextConfig);
    },
    [onConfigChange],
  );

  useEffect(() => {
    if (
      parsedConfig.success &&
      parsedConfig.normalized &&
      configKey !== stableStringify(parsedConfig.config)
    ) {
      onConfigChangeRef.current?.(parsedConfig.config);
    }
  }, [configKey, parsedConfig]);

  useEffect(() => {
    if (!tableName && effectiveTableName) {
      onTableNameChangeRef.current?.(effectiveTableName);
    }
  }, [effectiveTableName, tableName]);

  if (!chartConfig) {
    return (
      <div className="p-4">
        <div className="text-sm font-medium">Invalid chart configuration</div>
        <div className="text-muted-foreground mt-1 text-sm">
          This worksheet chart block could not be parsed as a Mosaic
          ChartConfig.
        </div>
        {!parsedConfig.success ? (
          <div className="text-muted-foreground mt-2 text-xs">
            {parsedConfig.error}
          </div>
        ) : null}
      </div>
    );
  }

  const settings = (
    <MosaicChartSettingsPanel
      dataTable={dataTable}
      config={chartConfig}
      onChange={handleConfigChange}
      onClose={() => handleSettingsOpenChange(false)}
    />
  );
  const content = (
    <div className="h-full overflow-auto p-2">
      <MosaicChartView
        dataTable={dataTable}
        config={chartConfig}
        selectionName={selectionName}
        retentionKey={runtimeKey}
        runtimeIssueKey={runtimeKey}
        className="h-full"
      />
    </div>
  );

  return (
    <div className="flex h-[420px] min-h-[320px] flex-col">
      <div className="border-border flex min-h-10 items-center gap-2 border-b px-3 py-2">
        {readOnly ? (
          <div className="min-w-0 flex-1 truncate text-sm font-medium">
            {caption || effectiveTableName || 'Chart'}
          </div>
        ) : (
          <input
            className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
            value={caption ?? ''}
            placeholder={effectiveTableName || 'Chart caption'}
            aria-label="Chart caption"
            onChange={(event) =>
              onCaptionChange?.(event.target.value || undefined)
            }
          />
        )}
        <Button
          type="button"
          size="icon"
          variant={chartConfig.settingsOpen ? 'secondary' : 'ghost'}
          className={cn('h-7 w-7', readOnly && 'hidden')}
          aria-label="Chart settings"
          title="Chart settings"
          aria-pressed={chartConfig.settingsOpen}
          onClick={() => handleSettingsOpenChange(!chartConfig.settingsOpen)}
        >
          <Settings2Icon className="h-4 w-4" />
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        <MosaicDashboardPanelLayout
          isOpen={Boolean(chartConfig.settingsOpen)}
          onIsOpenChange={handleSettingsOpenChange}
          settings={settings}
          content={content}
        />
      </div>
    </div>
  );
};

function parseWorksheetChartConfig(
  config: unknown,
  fallbackConfig?: ChartConfigType,
):
  | {
      success: true;
      config: ChartConfigType;
      normalized: boolean;
    }
  | {
      success: false;
      error: string;
    } {
  const parsed = ChartConfig.safeParse(config);
  if (parsed.success) {
    return {success: true, config: parsed.data, normalized: false};
  }

  if (
    fallbackConfig &&
    config &&
    typeof config === 'object' &&
    !Array.isArray(config) &&
    Object.keys(config).length === 0
  ) {
    return {success: true, config: fallbackConfig, normalized: true};
  }

  return {
    success: false,
    error:
      parsed.error.issues[0]?.message ??
      'The chart block is not a valid Mosaic ChartConfig.',
  };
}
