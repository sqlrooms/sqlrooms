import {
  blockDocumentContentToBlocks,
  createEmptyBlockDocumentContent,
  type BlockDocumentContent,
  type BlockDocumentStatefulBlockCreateNodeOptions,
  type BlockDocumentStatefulBlockType,
  type CreateBlockDocumentsSliceProps,
} from '@sqlrooms/documents';
import {MosaicDashboardSliceConfig} from '@sqlrooms/mosaic';
import {SQL_QUERY_BLOCK_TYPE} from '@sqlrooms/sql-editor';
import {
  createDefaultSqlEditorConfig,
  SqlEditorSliceConfig,
} from '@sqlrooms/sql-editor-config';
import type {JsonObject} from '#/lib/json';
import type {WorkspaceRoomState} from '../workspace/WorkspaceRoomStore';

export type PersistedWorksheetState = {
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
    state: WorkspaceRoomState,
    blockInstanceId: string,
    title: string,
    options?: BlockDocumentStatefulBlockCreateNodeOptions,
  ) => void;
  deleteState: (state: WorkspaceRoomState, blockInstanceId: string) => void;
  renameState?: (
    state: WorkspaceRoomState,
    blockInstanceId: string,
    title: string,
  ) => void;
};

const WORKSHEET_STATE_KEY = '__sqlroomsWorksheetState';

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

export function createWorkspaceBlockDocumentSliceProps(): CreateBlockDocumentsSliceProps<WorkspaceRoomState> {
  return {
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
    onDeleteOwnedStatefulBlock: ({blockType, blockInstanceId, getState}) => {
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
  };
}

export function createWorksheetStatefulBlockTypes({
  getState,
}: {
  getState: () => WorkspaceRoomState;
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

export function extractPersistedWorksheetState(
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

export function serializeWorksheetContent(
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

export function toBlockDocumentContent(
  content: JsonObject,
): BlockDocumentContent {
  if (content.type === 'doc' && Array.isArray(content.content)) {
    return normalizeWorksheetBlockDocumentContent(
      content as unknown as BlockDocumentContent,
    );
  }
  return createEmptyBlockDocumentContent();
}

export function ensureStatefulBlocksForContent(
  state: WorkspaceRoomState,
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
  state: WorkspaceRoomState,
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

function isOwnedStatefulBlock(
  block: ReturnType<typeof blockDocumentContentToBlocks>[number],
): block is Extract<
  ReturnType<typeof blockDocumentContentToBlocks>[number],
  {type: 'statefulBlock'}
> {
  return block.type === 'statefulBlock' && block.ownership !== 'external';
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
