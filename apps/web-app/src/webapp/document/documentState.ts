import {
  blockDocumentContentToBlocks,
  createEmptyBlockDocumentContent,
  type BlockDocumentContent,
  type BlockDocumentStatefulBlockCreateNodeOptions,
  type BlockDocumentStatefulBlockType,
  type BlockDocumentsSliceState,
  type CreateBlockDocumentsSliceProps,
} from '@sqlrooms/documents';
import {
  MosaicDashboardSliceConfig,
  type MosaicDashboardSliceState,
} from '@sqlrooms/mosaic';
import {
  SQL_QUERY_BLOCK_TYPE,
  type SqlEditorSliceState,
} from '@sqlrooms/sql-editor';
import type {BaseRoomStoreState} from '@sqlrooms/room-store';
import {
  createDefaultSqlEditorConfig,
  SqlEditorSliceConfig,
} from '@sqlrooms/sql-editor-config';
import type {JsonObject} from '#/lib/json';

type DocumentStatefulBlockRoomState = MosaicDashboardSliceState &
  SqlEditorSliceState;

type WorkspaceBlockDocumentRoomState = BaseRoomStoreState &
  BlockDocumentsSliceState &
  DocumentStatefulBlockRoomState;

export type PersistedDocumentState = {
  sqlEditor?: SqlEditorSliceConfig;
  mosaicDashboard?: MosaicDashboardSliceConfig;
};

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
    state: DocumentStatefulBlockRoomState,
    blockInstanceId: string,
    options?: BlockDocumentStatefulBlockCreateNodeOptions,
  ) => void;
  deleteState: (
    state: DocumentStatefulBlockRoomState,
    blockInstanceId: string,
  ) => void;
};

const DOCUMENT_STATE_KEY = '__sqlroomsDocumentState';

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
    ensureState: (state, blockInstanceId) => {
      state.mosaicDashboard.ensureDashboard(
        blockInstanceId,
        'Embedded Dashboard',
        'grid',
      );
    },
    deleteState: (state, blockInstanceId) => {
      state.mosaicDashboard.removeDashboard(blockInstanceId);
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
    ensureState: (state, blockInstanceId, options) => {
      state.sqlEditor.ensureQuery(blockInstanceId, {
        name: 'Embedded SQL Query',
        query: options?.initialText,
      });
    },
    deleteState: (state, blockInstanceId) => {
      state.sqlEditor.removeQuery(blockInstanceId);
    },
  },
];

const STATEFUL_BLOCK_CONFIG_BY_TYPE: Record<
  string,
  StatefulBlockConfig | undefined
> = Object.fromEntries(
  STATEFUL_BLOCK_CONFIGS.map((config) => [config.blockType, config]),
);

export function createWorkspaceBlockDocumentSliceProps<
  TRoomState extends WorkspaceBlockDocumentRoomState =
    WorkspaceBlockDocumentRoomState,
>(): CreateBlockDocumentsSliceProps<TRoomState> {
  return {
    onCreateOwnedStatefulBlock: ({
      blockType,
      blockInstanceId,
      caption,
      getState,
    }) => {
      ensureStatefulBlockState(getState(), {
        blockType,
        blockInstanceId,
        initialText: caption,
      });
    },
    onDeleteOwnedStatefulBlock: ({blockType, blockInstanceId, getState}) => {
      const config = STATEFUL_BLOCK_CONFIG_BY_TYPE[blockType];
      config?.deleteState(getState(), blockInstanceId);
    },
  };
}

export function createDocumentStatefulBlockTypes({
  getState,
}: {
  getState: () => DocumentStatefulBlockRoomState;
}): BlockDocumentStatefulBlockType[] {
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
      config.ensureState(getState(), blockId, options);
      return {
        type: 'blockDocumentStatefulBlock',
        attrs: {
          id: blockId,
          blockType: config.blockType,
          blockInstanceId: blockId,
          ownership: 'owned',
          caption: '',
          ...(config.resizableHeight
            ? {height: config.defaultHeight ?? 560}
            : {}),
        },
      };
    },
  }));
}

export function extractPersistedDocumentState(
  content: BlockDocumentContent,
): PersistedDocumentState {
  const candidate = (content as Record<string, unknown>)[DOCUMENT_STATE_KEY];
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

export function serializeDocumentContent(
  content: BlockDocumentContent,
  state: PersistedDocumentState,
): JsonObject {
  return {
    ...(content as unknown as JsonObject),
    [DOCUMENT_STATE_KEY]: state as unknown as JsonObject,
  };
}

export function normalizeDocumentBlockDocumentContent(
  content: BlockDocumentContent,
): BlockDocumentContent {
  return {
    type: 'doc',
    content: content.content.map(normalizeDocumentBlockDocumentNode),
  };
}

export function toBlockDocumentContent(
  content: JsonObject,
): BlockDocumentContent {
  if (content.type === 'doc' && Array.isArray(content.content)) {
    return normalizeDocumentBlockDocumentContent(
      content as unknown as BlockDocumentContent,
    );
  }
  return createEmptyBlockDocumentContent();
}

export function ensureStatefulBlocksForContent(
  state: DocumentStatefulBlockRoomState,
  content: BlockDocumentContent,
) {
  for (const block of blockDocumentContentToBlocks(content)) {
    if (block.type !== 'statefulBlock' || block.ownership === 'external') {
      continue;
    }

    ensureStatefulBlockState(state, {
      blockType: block.blockType,
      blockInstanceId: block.blockInstanceId,
      initialText: block.caption,
    });
  }
}

export function getOwnedStatefulBlockIds(content: BlockDocumentContent) {
  return new Set(
    blockDocumentContentToBlocks(content)
      .filter(isOwnedStatefulBlock)
      .map((block) => block.blockInstanceId),
  );
}

export function createEmptyPersistedSqlEditorConfig(): SqlEditorSliceConfig {
  return {
    ...createDefaultSqlEditorConfig(),
    queries: [],
    selectedQueryId: '',
    openTabs: [],
  };
}

function ensureStatefulBlockState(
  state: DocumentStatefulBlockRoomState,
  {
    blockType,
    blockInstanceId,
    initialText,
  }: {
    blockType: string;
    blockInstanceId: string;
    initialText?: string;
  },
) {
  const config = STATEFUL_BLOCK_CONFIG_BY_TYPE[blockType];
  config?.ensureState(state, blockInstanceId, {initialText});
}

function isOwnedStatefulBlock(
  block: ReturnType<typeof blockDocumentContentToBlocks>[number],
): block is Extract<
  ReturnType<typeof blockDocumentContentToBlocks>[number],
  {type: 'statefulBlock'}
> {
  return block.type === 'statefulBlock' && block.ownership !== 'external';
}

function normalizeDocumentBlockDocumentNode(
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
      content: node.content.map(normalizeDocumentBlockDocumentNode),
    };
  }

  return node;
}
