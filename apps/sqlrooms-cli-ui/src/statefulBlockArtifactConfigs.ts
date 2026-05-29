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
    ensureState: (state, artifactId, title) => {
      state.mosaicDashboard.ensureDashboard(artifactId, title);
    },
    deleteState: (state, artifactId) => {
      state.mosaicDashboard.removeDashboard(artifactId);
    },
    renameState: (state, artifactId, title) => {
      state.mosaicDashboard.ensureDashboard(artifactId, title);
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
} as const satisfies Record<string, StatefulBlockArtifactConfig>;

export type StatefulBlockArtifactType =
  keyof typeof STATEFUL_BLOCK_ARTIFACT_CONFIGS;

export const STATEFUL_BLOCK_ARTIFACT_TYPES = Object.keys(
  STATEFUL_BLOCK_ARTIFACT_CONFIGS,
) as StatefulBlockArtifactType[];

export function createStatefulBlockTypes({
  getState,
}: {
  getState: () => RoomState;
}): BlockDocumentStatefulBlockType[] {
  return STATEFUL_BLOCK_ARTIFACT_TYPES.map((artifactType) => {
    const config = STATEFUL_BLOCK_ARTIFACT_CONFIGS[artifactType];
    return {
      blockType: config.artifactType,
      label: config.label,
      description: config.embeddedDescription,
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
          },
        };
      },
    };
  });
}

export function createStatefulBlockCommandTypes(): BlockDocumentStatefulBlockCommandType<RoomState>[] {
  return STATEFUL_BLOCK_ARTIFACT_TYPES.map((artifactType) => {
    const config = STATEFUL_BLOCK_ARTIFACT_CONFIGS[artifactType];
    return {
      blockType: config.artifactType,
      label: config.label,
      description: config.embeddedDescription,
      defaultTitle: config.embeddedTitle,
      ensureState: ({state, blockInstanceId, title}) => {
        config.ensureState(state, blockInstanceId, title);
      },
    };
  });
}
