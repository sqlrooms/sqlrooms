import type {
  BlockDocumentStatefulBlockCreateNodeOptions,
  BlockDocumentStatefulBlockCommandType,
  BlockDocumentStatefulBlockType,
} from '@sqlrooms/documents';
import type {RoomState} from './store-types';

export type StatefulBlockArtifactConfig<TArtifactType extends string = string> =
  {
    artifactType: TArtifactType;
    label: string;
    defaultTitle: string;
    embeddedTitle: string;
    embeddedDescription: string;
    resizableHeight?: boolean;
    defaultHeight?: number;
    minHeight?: number;
    maxHeight?: number;
    requireScrollModifier?: boolean;
    scrollHintLabel?: string;
    ensureState: (
      state: RoomState,
      artifactId: string,
      title: string,
      options?: BlockDocumentStatefulBlockCreateNodeOptions,
    ) => void;
    deleteState: (state: RoomState, artifactId: string) => void;
    renameState?: (state: RoomState, artifactId: string, title: string) => void;
  };

export const STATEFUL_BLOCK_ARTIFACT_CONFIGS = {
  dashboard: {
    artifactType: 'dashboard',
    label: 'Dashboard',
    defaultTitle: 'Dashboard',
    embeddedTitle: 'Embedded Dashboard',
    embeddedDescription: 'Embedded dashboard',
    resizableHeight: true,
    defaultHeight: 560,
    minHeight: 360,
    maxHeight: 1600,
    requireScrollModifier: true,
    scrollHintLabel: 'this dashboard',
    ensureState: (state, artifactId, title) => {
      state.mosaicDashboard.ensureDashboard(artifactId, title, 'grid');
    },
    deleteState: (state, artifactId) => {
      state.mosaicDashboard.removeDashboard(artifactId);
    },
    renameState: (state, artifactId, title) => {
      state.mosaicDashboard.ensureDashboard(artifactId, title, 'grid');
    },
  },
  pivot: {
    artifactType: 'pivot',
    label: 'Pivot Table',
    defaultTitle: 'Pivot Table',
    embeddedTitle: 'Embedded Pivot Table',
    embeddedDescription: 'Embedded pivot table',
    ensureState: (state, artifactId, title) => {
      state.pivot.ensurePivot(artifactId, {title});
    },
    deleteState: (state, artifactId) => {
      state.pivot.removePivot(artifactId);
    },
    renameState: (state, artifactId, title) => {
      state.pivot.renamePivot(artifactId, title);
    },
  },
  'data-table': {
    artifactType: 'data-table',
    label: 'Data Table',
    defaultTitle: 'Data Table',
    embeddedTitle: 'Data Table',
    embeddedDescription: 'Embedded Mosaic Data Table Explorer',
    resizableHeight: true,
    defaultHeight: 640,
    minHeight: 360,
    maxHeight: 1600,
    requireScrollModifier: true,
    scrollHintLabel: 'this data table',
    ensureState: () => {},
    deleteState: () => {},
  },
  document: {
    artifactType: 'document',
    label: 'Document',
    defaultTitle: 'Document',
    embeddedTitle: 'Embedded Document',
    embeddedDescription: 'Embedded Markdown document',
    ensureState: (state, artifactId, _title, options) => {
      state.documents.ensureDocument(artifactId, options?.initialText);
    },
    deleteState: (state, artifactId) => {
      state.documents.removeDocument(artifactId);
    },
  },
  'sql-query': {
    artifactType: 'sql-query',
    label: 'SQL Query',
    defaultTitle: 'SQL Query',
    embeddedTitle: 'Embedded SQL Query',
    embeddedDescription: 'Embedded SQL query editor and result table',
    resizableHeight: true,
    defaultHeight: 720,
    minHeight: 420,
    maxHeight: 1600,
    requireScrollModifier: true,
    scrollHintLabel: 'this SQL query',
    ensureState: (state, artifactId, title, options) => {
      state.sqlEditor.ensureQuery(artifactId, {
        name: title,
        query: options?.initialText,
      });
    },
    deleteState: (state, artifactId) => {
      state.sqlEditor.removeQuery(artifactId);
    },
    renameState: (state, artifactId, title) => {
      state.sqlEditor.renameQuery(artifactId, title);
    },
  },
} as const satisfies Record<string, StatefulBlockArtifactConfig>;

export type StatefulBlockArtifactType =
  keyof typeof STATEFUL_BLOCK_ARTIFACT_CONFIGS;

export const STATEFUL_BLOCK_ARTIFACT_TYPES = Object.keys(
  STATEFUL_BLOCK_ARTIFACT_CONFIGS,
) as StatefulBlockArtifactType[];

export function isStatefulBlockArtifactType(
  artifactType: string,
): artifactType is StatefulBlockArtifactType {
  return artifactType in STATEFUL_BLOCK_ARTIFACT_CONFIGS;
}

export function getStatefulBlockArtifactConfig(
  artifactType: StatefulBlockArtifactType,
): StatefulBlockArtifactConfig<StatefulBlockArtifactType> {
  return STATEFUL_BLOCK_ARTIFACT_CONFIGS[artifactType];
}

export function createStatefulBlockTypes({
  getState,
}: {
  getState: () => RoomState;
}): BlockDocumentStatefulBlockType[] {
  return STATEFUL_BLOCK_ARTIFACT_TYPES.map((artifactType) => {
    const config = getStatefulBlockArtifactConfig(artifactType);
    return {
      blockType: config.artifactType,
      label: config.label,
      description: config.embeddedDescription,
      resizableHeight: config.resizableHeight,
      defaultHeight: config.defaultHeight,
      minHeight: config.minHeight,
      maxHeight: config.maxHeight,
      requireScrollModifier: config.requireScrollModifier,
      scrollHintLabel: config.scrollHintLabel,
      createNode: (blockId, options) => {
        const state = getState();
        config.ensureState(state, blockId, config.embeddedTitle, options);
        return {
          type: 'blockDocumentStatefulBlock',
          attrs: {
            id: blockId,
            blockType: config.artifactType,
            blockInstanceId: blockId,
            ownership: 'owned',
            title: config.embeddedTitle,
            caption: '',
            ...(config.resizableHeight
              ? {height: config.defaultHeight ?? 560}
              : {}),
          },
        };
      },
    };
  });
}

export function createStatefulBlockCommandTypes(): BlockDocumentStatefulBlockCommandType<RoomState>[] {
  return STATEFUL_BLOCK_ARTIFACT_TYPES.map((artifactType) => {
    const config = getStatefulBlockArtifactConfig(artifactType);
    return {
      blockType: config.artifactType,
      label: config.label,
      description: config.embeddedDescription,
      defaultTitle: config.embeddedTitle,
      defaultHeight: config.defaultHeight,
      ensureState: ({state, blockInstanceId, title}) => {
        config.ensureState(state, blockInstanceId, title);
      },
    };
  });
}
