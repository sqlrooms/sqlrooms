import type {
  CliAiBlockType,
  CliArtifactType,
  StatefulBlockArtifactType,
} from '../artifactTypeIds';

/** Names of production capability profiles supported by the SQLRooms CLI. */
export const CLI_CAPABILITY_PROFILE_NAMES = [
  'default',
  'experimental',
  'document-charts-maps',
] as const;

/** A production capability profile name accepted by the CLI runtime. */
export type CliCapabilityProfileName =
  (typeof CLI_CAPABILITY_PROFILE_NAMES)[number];

export type CliCommandGroupId =
  | 'dashboard'
  | 'mosaic-dashboard'
  | 'markdown'
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
  | 'document-agent'
  | 'webcontainer'
  | 'chart'
  | 'chart-image-for-markdown';

export type CliNestedAgentId =
  | 'dashboard'
  | 'document'
  | 'document-dashboard'
  | 'html-app';

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
  };
  readonly commands: readonly CliCommandGroupId[];
  readonly ai: {
    readonly instructionSets: readonly CliInstructionSetId[];
    readonly topLevelToolGroups: readonly CliTopLevelToolGroupId[];
    readonly nestedAgents: readonly CliNestedAgentId[];
  };
  readonly skills: readonly string[];
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
