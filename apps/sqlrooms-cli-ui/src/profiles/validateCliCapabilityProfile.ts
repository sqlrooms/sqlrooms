import {
  CLI_AI_BLOCK_TYPES,
  CLI_ARTIFACT_TYPES,
  type CliAiBlockType,
  type CliArtifactType,
} from '../artifactTypeIds';
import {
  STATEFUL_BLOCK_ARTIFACT_TYPES,
  type StatefulBlockArtifactType,
} from '../statefulBlockArtifactConfigs';
import type {
  CliCapabilityProfile,
  CliCommandGroupId,
  CliTopLevelToolGroupId,
} from './types';

const COMMAND_GROUPS: readonly CliCommandGroupId[] = [
  'dashboard',
  'mosaic-dashboard',
  'document',
  'block-document',
  'cli-block-document',
  'block-document-python',
  'html-app-revision',
];

const TOP_LEVEL_TOOL_GROUPS: readonly CliTopLevelToolGroupId[] = [
  'default-data-analysis',
  'artifact-context',
  'dashboard-agent',
  'html-app-agent',
  'worksheet-agent',
  'webcontainer',
  'chart',
  'chart-image-for-markdown',
];

function findDuplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (seen.has(value)) return true;
    seen.add(value);
    return false;
  });
}

function validateKnownValues<TValue extends string>(
  label: string,
  values: readonly TValue[],
  knownValues: readonly TValue[],
): string[] {
  const known = new Set<string>(knownValues);
  return values
    .filter((value) => !known.has(value))
    .map((value) => `${label} contains unknown value "${value}".`);
}

/** Returns actionable coherence errors for a production capability profile. */
export function validateCliCapabilityProfile(
  profile: CliCapabilityProfile,
): string[] {
  const errors: string[] = [];
  const lists: Array<[string, readonly string[]]> = [
    ['artifacts.creatable', profile.artifacts.creatable],
    ['artifacts.runContext', profile.artifacts.runContext],
    ['blocks.stateful', profile.blocks.stateful],
    ['blocks.aiContext', profile.blocks.aiContext],
    ['commands', profile.commands],
    ['ai.instructionSets', profile.ai.instructionSets],
    ['ai.topLevelToolGroups', profile.ai.topLevelToolGroups],
    ['ai.nestedAgents', profile.ai.nestedAgents],
    ['skills', profile.skills],
  ];
  for (const [label, values] of lists) {
    for (const duplicate of findDuplicates(values)) {
      errors.push(`${label} contains duplicate value "${duplicate}".`);
    }
  }

  errors.push(
    ...validateKnownValues<CliArtifactType>(
      'artifacts.creatable',
      profile.artifacts.creatable,
      CLI_ARTIFACT_TYPES,
    ),
    ...validateKnownValues<CliArtifactType>(
      'artifacts.runContext',
      profile.artifacts.runContext,
      CLI_ARTIFACT_TYPES,
    ),
    ...validateKnownValues<StatefulBlockArtifactType>(
      'blocks.stateful',
      profile.blocks.stateful,
      STATEFUL_BLOCK_ARTIFACT_TYPES,
    ),
    ...validateKnownValues<CliAiBlockType>(
      'blocks.aiContext',
      profile.blocks.aiContext,
      CLI_AI_BLOCK_TYPES,
    ),
    ...validateKnownValues('commands', profile.commands, COMMAND_GROUPS),
    ...validateKnownValues(
      'ai.topLevelToolGroups',
      profile.ai.topLevelToolGroups,
      TOP_LEVEL_TOOL_GROUPS,
    ),
  );

  const stateful = new Set<string>(profile.blocks.stateful);
  for (const blockType of profile.blocks.aiContext) {
    if (blockType !== 'chart' && !stateful.has(blockType)) {
      errors.push(
        `AI context block "${blockType}" must also be an enabled stateful block.`,
      );
    }
  }

  const commands = new Set<string>(profile.commands);
  if (commands.has('document') && !stateful.has('document')) {
    errors.push('Document commands require the document stateful block.');
  }
  if (commands.has('block-document-python') && !stateful.has('python')) {
    errors.push('Python block commands require the python stateful block.');
  }
  if (commands.has('html-app-revision') && !stateful.has('html-app')) {
    errors.push(
      'HTML app revision commands require the html-app stateful block.',
    );
  }

  const tools = new Set<string>(profile.ai.topLevelToolGroups);
  const nestedAgents = new Set<string>(profile.ai.nestedAgents);
  const artifacts = new Set<string>(profile.artifacts.creatable);
  if (tools.has('html-app-agent') && !artifacts.has('html-app')) {
    errors.push(
      'The top-level HTML app agent requires creatable html-app artifacts.',
    );
  }
  if (profile.dashboard.deckMaps && !stateful.has('map')) {
    errors.push('Dashboard Deck maps require the map stateful capability.');
  }
  if (tools.has('dashboard-agent') !== nestedAgents.has('dashboard')) {
    errors.push(
      'The dashboard-agent tool group and dashboard nested agent must be enabled together.',
    );
  }
  if (tools.has('dashboard-agent') && !artifacts.has('dashboard')) {
    errors.push(
      'The top-level dashboard agent requires creatable dashboard artifacts.',
    );
  }
  if (tools.has('worksheet-agent') !== nestedAgents.has('worksheet')) {
    errors.push(
      'The worksheet-agent tool group and worksheet nested agent must be enabled together.',
    );
  }
  if (tools.has('html-app-agent') !== nestedAgents.has('html-app')) {
    errors.push(
      'The html-app-agent tool group and HTML app nested agent must be enabled together.',
    );
  }
  if (nestedAgents.has('worksheet-dashboard') && !stateful.has('dashboard')) {
    errors.push(
      'The embedded worksheet-dashboard agent requires dashboard blocks.',
    );
  }
  if (
    nestedAgents.has('worksheet') &&
    stateful.has('dashboard') &&
    !nestedAgents.has('worksheet-dashboard')
  ) {
    errors.push(
      'A worksheet agent with dashboard blocks requires its embedded worksheet-dashboard agent.',
    );
  }

  return errors;
}
