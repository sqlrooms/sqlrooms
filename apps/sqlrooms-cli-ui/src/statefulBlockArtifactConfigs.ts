import type {BlocksDocumentArtifactEmbedType} from '@sqlrooms/documents';
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
    ensureState: (state, artifactId) => {
      state.dashboard.ensureDashboardArtifact(artifactId);
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
} as const satisfies Record<string, StatefulBlockArtifactConfig>;

export type StatefulBlockArtifactType =
  keyof typeof STATEFUL_BLOCK_ARTIFACT_CONFIGS;

export const STATEFUL_BLOCK_ARTIFACT_TYPES = Object.keys(
  STATEFUL_BLOCK_ARTIFACT_CONFIGS,
) as StatefulBlockArtifactType[];

export function createStatefulBlockArtifactEmbedTypes({
  parentArtifactId,
  getState,
}: {
  parentArtifactId: string;
  getState: () => RoomState;
}): BlocksDocumentArtifactEmbedType[] {
  return STATEFUL_BLOCK_ARTIFACT_TYPES.map((artifactType) => {
    const config = STATEFUL_BLOCK_ARTIFACT_CONFIGS[artifactType];
    return {
      artifactType: config.artifactType,
      label: config.label,
      description: config.embeddedDescription,
      createNode: (blockId) => {
        const state = getState();
        const embeddedArtifactId = state.artifacts.createArtifact({
          type: config.artifactType,
          title: config.embeddedTitle,
          visibility: 'embedded',
          parentArtifactId,
        });
        const embeddedArtifact = state.artifacts.getArtifact(embeddedArtifactId);
        config.ensureState(
          state,
          embeddedArtifactId,
          embeddedArtifact?.title ?? config.embeddedTitle,
        );
        return {
          type: 'blocksDocumentArtifactEmbed',
          attrs: {
            id: blockId,
            artifactId: embeddedArtifactId,
            artifactType: config.artifactType,
            caption: '',
          },
        };
      },
    };
  });
}
