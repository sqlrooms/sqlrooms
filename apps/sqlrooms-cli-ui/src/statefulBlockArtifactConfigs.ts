import type {BlocksDocumentStatefulBlockType} from '@sqlrooms/documents';
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
    ) => void;
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
  },
  document: {
    artifactType: 'document',
    label: 'Document',
    defaultTitle: 'Document',
    embeddedTitle: 'Embedded Document',
    embeddedDescription: 'Embedded Markdown document',
    ensureState: (state, artifactId) => {
      state.documents.ensureDocument(artifactId);
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
}): BlocksDocumentStatefulBlockType[] {
  return STATEFUL_BLOCK_ARTIFACT_TYPES.map((artifactType) => {
    const config = STATEFUL_BLOCK_ARTIFACT_CONFIGS[artifactType];
    return {
      blockType: config.artifactType,
      label: config.label,
      description: config.embeddedDescription,
      createNode: (blockId) => {
        const state = getState();
        config.ensureState(state, blockId, config.embeddedTitle);
        return {
          type: 'blocksDocumentStatefulBlock',
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
