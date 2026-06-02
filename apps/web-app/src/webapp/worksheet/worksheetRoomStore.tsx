import {
  BlockDocumentArtifact,
  BlockDocumentChartRendererProvider,
  BlockDocumentStatefulBlockRendererProvider,
  blockDocumentContentToBlocks,
  createBlockDocumentsSlice,
  type BlockDocumentChartRenderer,
  type BlockDocumentContent,
  type BlockDocumentStatefulBlockCreateNodeOptions,
  type BlockDocumentStatefulBlockRenderer,
  type BlockDocumentStatefulBlockRendererProps,
  type BlockDocumentStatefulBlockType,
  type BlockDocumentsSliceState,
} from '@sqlrooms/documents';
import {
  createDbSlice,
  type DbSliceState,
} from '@sqlrooms/db';
import type {DuckDbConnector} from '@sqlrooms/duckdb';
import {
  ChartConfig,
  DataTableBlockRenderer,
  defaultAddPanelActions,
  createDefaultMosaicDashboardPanelRenderers,
  createMosaicDashboardSlice,
  createMosaicSlice,
  MosaicDashboardSliceConfig,
  MosaicChartSettingsPanel,
  MosaicChartView,
  MosaicDashboard,
  MosaicDashboardPanelLayout,
  useTablesWithColumns,
  type MosaicDashboardSliceConfigType,
  type MosaicDashboardSliceState,
  type MosaicSliceState,
} from '@sqlrooms/mosaic';
import {
  createBaseRoomSlice,
  createCommandSlice,
  createRoomStore,
  RoomStateProvider,
  useBaseRoomStore,
  useRoomStoreApi,
  type BaseRoomStore,
  type BaseRoomStoreState,
  type CommandSliceState,
} from '@sqlrooms/room-store';
import {
  createSqlEditorSlice,
  SQL_QUERY_BLOCK_TYPE,
  SqlQueryBlock,
  SqlEditorSliceConfig,
  type SqlEditorSliceState,
} from '@sqlrooms/sql-editor';
import {Button, cn} from '@sqlrooms/ui';
import {Settings2Icon} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type PropsWithChildren,
} from 'react';
import type {JsonObject} from '#/lib/json';

type ChartConfigType = ReturnType<typeof ChartConfig.parse>;

export interface WebWorksheetRoomState
  extends BaseRoomStoreState,
    CommandSliceState<WebWorksheetRoomState>,
    DbSliceState,
    MosaicSliceState,
    MosaicDashboardSliceState,
    SqlEditorSliceState,
    BlockDocumentsSliceState {}

type PersistedWorksheetState = {
  sqlEditor?: SqlEditorSliceConfig;
  mosaicDashboard?: MosaicDashboardSliceConfigType;
};

const WORKSHEET_STATE_KEY = '__sqlroomsWorksheetState';

type StatefulBlockConfig = {
  blockType: 'dashboard' | 'data-table' | typeof SQL_QUERY_BLOCK_TYPE;
  label: string;
  title: string;
  description: string;
  resizableHeight?: boolean;
  defaultHeight?: number;
  minHeight?: number;
  maxHeight?: number;
  requireScrollModifier?: boolean;
  scrollHintLabel?: string;
  ensureState: (
    state: WebWorksheetRoomState,
    blockInstanceId: string,
    title: string,
    options?: BlockDocumentStatefulBlockCreateNodeOptions,
  ) => void;
  deleteState: (
    state: WebWorksheetRoomState,
    blockInstanceId: string,
  ) => void;
  renameState?: (
    state: WebWorksheetRoomState,
    blockInstanceId: string,
    title: string,
  ) => void;
};

const STATEFUL_BLOCK_CONFIGS: StatefulBlockConfig[] = [
  {
    blockType: 'dashboard',
    label: 'Dashboard',
    title: 'Embedded Dashboard',
    description: 'Embedded dashboard',
    resizableHeight: true,
    defaultHeight: 560,
    minHeight: 360,
    maxHeight: 1600,
    requireScrollModifier: true,
    scrollHintLabel: 'this dashboard',
    ensureState: (state, blockInstanceId, title) => {
      state.mosaicDashboard.ensureDashboard(blockInstanceId, title, 'grid');
    },
    deleteState: (state, blockInstanceId) => {
      state.mosaicDashboard.removeDashboard(blockInstanceId);
    },
    renameState: (state, blockInstanceId, title) => {
      state.mosaicDashboard.ensureDashboard(blockInstanceId, title, 'grid');
    },
  },
  {
    blockType: 'data-table',
    label: 'Data Table',
    title: 'Data Table',
    description: 'Embedded Mosaic Data Table Explorer',
    resizableHeight: true,
    defaultHeight: 640,
    minHeight: 360,
    maxHeight: 1600,
    requireScrollModifier: true,
    scrollHintLabel: 'this data table',
    ensureState: () => {},
    deleteState: () => {},
  },
  {
    blockType: SQL_QUERY_BLOCK_TYPE,
    label: 'SQL Query',
    title: 'Embedded SQL Query',
    description: 'Embedded SQL query editor and result table',
    ensureState: (state, blockInstanceId, title, options) => {
      state.sqlEditor.ensureQuery(blockInstanceId, {
        name: title,
        query: options?.initialText,
      });
    },
    deleteState: (state, blockInstanceId) => {
      state.sqlEditor.removeQuery(blockInstanceId);
    },
    renameState: (state, blockInstanceId, title) => {
      state.sqlEditor.renameQuery(blockInstanceId, title);
    },
  },
];

const STATEFUL_BLOCK_CONFIG_BY_TYPE: Record<
  string,
  StatefulBlockConfig | undefined
> = Object.fromEntries(
  STATEFUL_BLOCK_CONFIGS.map((config) => [config.blockType, config]),
);

export function createWebWorksheetRoomStore({
  connector,
  content,
  worksheetId,
}: {
  connector: DuckDbConnector;
  content: BlockDocumentContent;
  worksheetId: string;
}): BaseRoomStore<WebWorksheetRoomState> {
  const persistedState = extractPersistedWorksheetState(content);
  const normalizedContent = normalizeWorksheetBlockDocumentContent(content);

  const {roomStore} = createRoomStore<WebWorksheetRoomState>(
    (set, get, store) => ({
      ...createBaseRoomSlice()(set, get, store),
      ...createCommandSlice<WebWorksheetRoomState>()(set, get, store),
      ...createDbSlice({
        duckDb: {connector},
        config: {currentRuntime: 'browser'},
      })(set, get, store),
      ...createSqlEditorSlice({
        config: persistedState.sqlEditor,
      })(set, get, store),
      ...createMosaicSlice()(set, get, store),
      ...createMosaicDashboardSlice({
        config: persistedState.mosaicDashboard,
        addPanelActions: defaultAddPanelActions,
        panelRenderers: createDefaultMosaicDashboardPanelRenderers(),
      })(set, get, store),
      ...createBlockDocumentsSlice<WebWorksheetRoomState>({
        config: {
          artifacts: {
            [worksheetId]: {
              id: worksheetId,
              content: normalizedContent,
              assets: {},
              updatedAt: Date.now(),
            },
          },
        },
        onCreateOwnedStatefulBlock: ({
          blockType,
          blockInstanceId,
          title,
          caption,
          getState,
        }) => {
          ensureStatefulBlockState(getState(), {
            blockType,
            blockInstanceId,
            title,
            initialText: caption,
          });
        },
        onDeleteOwnedStatefulBlock: ({
          blockType,
          blockInstanceId,
          getState,
        }) => {
          const config = STATEFUL_BLOCK_CONFIG_BY_TYPE[blockType];
          config?.deleteState(getState(), blockInstanceId);
        },
        onRenameOwnedStatefulBlock: ({
          blockType,
          blockInstanceId,
          title,
          getState,
        }) => {
          const config = STATEFUL_BLOCK_CONFIG_BY_TYPE[blockType];
          config?.renameState?.(getState(), blockInstanceId, title);
        },
      })(set, get, store),
    }),
  );

  ensureStatefulBlocksForContent(roomStore.getState(), normalizedContent);
  return roomStore;
}

export function WebWorksheetRoomProvider({
  children,
  roomStore,
}: PropsWithChildren<{
  roomStore: BaseRoomStore<WebWorksheetRoomState>;
}>) {
  return <RoomStateProvider roomStore={roomStore}>{children}</RoomStateProvider>;
}

export function WorksheetBlockDocument({
  title,
  worksheetId,
  onTitleChange,
}: {
  title: string;
  worksheetId: string;
  onTitleChange: (title: string) => void;
}) {
  const roomStore = useRoomStoreApi<WebWorksheetRoomState>();
  const blockTypes = useMemo(
    () => createWorksheetStatefulBlockTypes(roomStore.getState),
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
  const content = useBaseRoomStore<WebWorksheetRoomState, BlockDocumentContent>(
    (state) =>
      state.blockDocuments.config.artifacts[worksheetId]?.content ?? {
        type: 'doc',
        content: [],
      },
  );
  const sqlEditorConfig = useBaseRoomStore<
    WebWorksheetRoomState,
    SqlEditorSliceConfig
  >((state) => state.sqlEditor.config);
  const mosaicDashboardConfig = useBaseRoomStore<
    WebWorksheetRoomState,
    MosaicDashboardSliceConfigType
  >((state) => state.mosaicDashboard.config);

  return useMemo(
    () =>
      serializeWorksheetContent(content, {
        sqlEditor: sqlEditorConfig,
        mosaicDashboard: mosaicDashboardConfig,
      }),
    [content, mosaicDashboardConfig, sqlEditorConfig],
  );
}

export function useRefreshWorksheetDbSchemas(tableNames: string[]) {
  const refreshTableSchemas = useBaseRoomStore<
    WebWorksheetRoomState,
    WebWorksheetRoomState['db']['refreshTableSchemas']
  >((state) => state.db.refreshTableSchemas);
  const tableNamesKey = tableNames.join('\0');

  useEffect(() => {
    void refreshTableSchemas();
  }, [refreshTableSchemas, tableNamesKey]);
}

function createWorksheetStatefulBlockTypes(
  getState: () => WebWorksheetRoomState,
): BlockDocumentStatefulBlockType[] {
  return STATEFUL_BLOCK_CONFIGS.map((config) => ({
    blockType: config.blockType,
    label: config.label,
    description: config.description,
    resizableHeight: config.resizableHeight,
    defaultHeight: config.defaultHeight,
    minHeight: config.minHeight,
    maxHeight: config.maxHeight,
    requireScrollModifier: config.requireScrollModifier,
    scrollHintLabel: config.scrollHintLabel,
    createNode: (blockId, options) => {
      config.ensureState(getState(), blockId, config.title, options);
      return {
        type: 'blockDocumentStatefulBlock',
        attrs: {
          id: blockId,
          blockType: config.blockType,
          blockInstanceId: blockId,
          ownership: 'owned',
          title: config.title,
          caption: '',
          ...(config.resizableHeight
            ? {height: config.defaultHeight ?? 560}
            : {}),
        },
      };
    },
  }));
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
    WebWorksheetRoomState,
    WebWorksheetRoomState['blockDocuments']['updateBlock']
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

  return <DataTableBlockRenderer {...props} onTitleChange={handleTitleChange} />;
};

const WorksheetDashboardBlockRenderer = ({
  blockInstanceId,
  blockType,
  title,
  caption,
}: BlockDocumentStatefulBlockRendererProps) => {
  const ensureDashboard = useBaseRoomStore<
    WebWorksheetRoomState,
    WebWorksheetRoomState['mosaicDashboard']['ensureDashboard']
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
      tableName={effectiveTableName}
      config={chartConfig}
      onChange={handleConfigChange}
      onClose={() => handleSettingsOpenChange(false)}
    />
  );
  const content = (
    <div className="h-full overflow-auto p-2">
      <MosaicChartView
        tableName={effectiveTableName}
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

function ensureStatefulBlocksForContent(
  state: WebWorksheetRoomState,
  content: BlockDocumentContent,
) {
  for (const block of blockDocumentContentToBlocks(content)) {
    if (block.type !== 'statefulBlock' || block.ownership === 'external') {
      continue;
    }

    ensureStatefulBlockState(state, {
      blockType: block.blockType,
      blockInstanceId: block.blockInstanceId,
      title: block.title,
      initialText: block.caption,
    });
  }
}

function ensureStatefulBlockState(
  state: WebWorksheetRoomState,
  {
    blockType,
    blockInstanceId,
    initialText,
    title,
  }: {
    blockType: string;
    blockInstanceId: string;
    initialText?: string;
    title?: string;
  },
) {
  const config = STATEFUL_BLOCK_CONFIG_BY_TYPE[blockType];
  config?.ensureState(state, blockInstanceId, title ?? config.title, {
    initialText,
  });
}

function extractPersistedWorksheetState(
  content: BlockDocumentContent,
): PersistedWorksheetState {
  const candidate = (content as Record<string, unknown>)[WORKSHEET_STATE_KEY];
  if (!candidate || typeof candidate !== 'object') return {};
  const state = candidate as Record<string, unknown>;
  const sqlEditor = SqlEditorSliceConfig.safeParse(state.sqlEditor);
  const mosaicDashboard = MosaicDashboardSliceConfig.safeParse(
    state.mosaicDashboard,
  );

  return {
    sqlEditor: sqlEditor.success ? sqlEditor.data : undefined,
    mosaicDashboard: mosaicDashboard.success ? mosaicDashboard.data : undefined,
  };
}

function serializeWorksheetContent(
  content: BlockDocumentContent,
  state: PersistedWorksheetState,
): JsonObject {
  return {
    ...(content as unknown as JsonObject),
    [WORKSHEET_STATE_KEY]: state as unknown as JsonObject,
  };
}

export function normalizeWorksheetBlockDocumentContent(
  content: BlockDocumentContent,
): BlockDocumentContent {
  return {
    type: 'doc',
    content: content.content.map(normalizeWorksheetBlockDocumentNode),
  };
}

function normalizeWorksheetBlockDocumentNode(
  node: BlockDocumentContent['content'][number],
): BlockDocumentContent['content'][number] {
  if (node.type === 'blockDocumentStatefulBlock') {
    const attrs = {...(node.attrs ?? {})};

    if (attrs.blockType === 'query') {
      return {
        ...node,
        attrs: {
          ...attrs,
          blockType: SQL_QUERY_BLOCK_TYPE,
          title: attrs.title ?? 'Embedded SQL Query',
        },
      };
    }

    if (attrs.blockType === 'chart') {
      return {
        type: 'blockDocumentChart',
        attrs: {
          id: attrs.id,
          tableName: '',
          config: {},
          caption: attrs.caption,
        },
      };
    }
  }

  if (Array.isArray(node.content)) {
    return {
      ...node,
      content: node.content.map(normalizeWorksheetBlockDocumentNode),
    };
  }

  return node;
}
