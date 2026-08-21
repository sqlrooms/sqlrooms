import type {
  CliAiBlockType,
  CliArtifactType,
  StatefulBlockArtifactType,
} from '../artifactTypeIds';

/** Names of production capability profiles supported by the SQLRooms CLI. */
export const CLI_CAPABILITY_PROFILE_NAMES = [
  'default',
  'experimental',
] as const;

/** A production capability profile name accepted by the CLI runtime. */
export type CliCapabilityProfileName =
  (typeof CLI_CAPABILITY_PROFILE_NAMES)[number];

export type CliCommandGroupId =
  | 'dashboard'
  | 'mosaic-dashboard'
  | 'document'
  | 'block-document'
  | 'cli-block-document'
  | 'block-document-python'
  | 'html-app-revision';

export type CliInstructionSetId = 'stable' | 'experimental';

export type CliTopLevelToolGroupId =
  | 'default-data-analysis'
  | 'artifact-context'
  | 'dashboard-agent'
  | 'html-app-agent'
  | 'worksheet-agent'
  | 'webcontainer'
  | 'chart'
  | 'chart-image-for-markdown';

export type CliNestedAgentId =
  | 'dashboard'
  | 'worksheet'
  | 'worksheet-dashboard'
  | 'html-app';

export type CliLifecycleSliceId =
  | 'ai'
  | 'ai-settings'
  | 'app-project'
  | 'artifacts'
  | 'artifact-ai'
  | 'block-documents'
  | 'canvas'
  | 'cells'
  | 'crdt'
  | 'dashboard'
  | 'dashboard-features'
  | 'db-settings'
  | 'deck-maps'
  | 'documents'
  | 'html-apps'
  | 'mosaic'
  | 'notebook'
  | 'pivot'
  | 'python'
  | 'room-shell'
  | 'sql-editor'
  | 'webcontainer'
  | 'workspace-ui';

/**
 * Complete, app-private description of a coherent SQLRooms CLI capability set.
 *
 * Profiles are production configurations rather than arbitrary feature flags.
 * UI, command, context, and AI composition all consume the same definition.
 */
export type CliCapabilityProfile = {
  readonly name: CliCapabilityProfileName;
  readonly version: number;
  readonly artifacts: {
    readonly creatable: readonly CliArtifactType[];
    readonly runContext: readonly CliArtifactType[];
  };
  readonly blocks: {
    readonly stateful: readonly StatefulBlockArtifactType[];
    readonly aiContext: readonly CliAiBlockType[];
    readonly interactiveRenderers: readonly (
      | 'chart'
      | StatefulBlockArtifactType
    )[];
    readonly placeholderRenderers: readonly StatefulBlockArtifactType[];
  };
  readonly commands: readonly CliCommandGroupId[];
  readonly ai: {
    readonly instructionSets: readonly CliInstructionSetId[];
    readonly topLevelToolGroups: readonly CliTopLevelToolGroupId[];
    readonly nestedAgents: readonly CliNestedAgentId[];
  };
  readonly skills: readonly string[];
  readonly lifecycleSlices: readonly CliLifecycleSliceId[];
  readonly dashboard: {
    readonly deckMaps: boolean;
  };
};

/** JSON-safe representation used to lock profile behavior in snapshots. */
export type CliCapabilityProfileSnapshot = CliCapabilityProfile;

/** Returns a JSON-safe copy suitable for deterministic capability snapshots. */
export function createCliCapabilityProfileSnapshot(
  profile: CliCapabilityProfile,
): CliCapabilityProfileSnapshot {
  return JSON.parse(JSON.stringify(profile)) as CliCapabilityProfileSnapshot;
}
