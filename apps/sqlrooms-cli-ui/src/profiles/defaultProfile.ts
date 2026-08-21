import {CLI_ARTIFACT_TYPES} from '../artifactTypeIds';
import type {CliCapabilityProfile} from './types';

/** Current non-experimental SQLRooms CLI behavior. */
export const DEFAULT_CLI_CAPABILITY_PROFILE = {
  name: 'default',
  version: 1,
  artifacts: {
    creatable: ['worksheet', 'dashboard'],
    runContext: CLI_ARTIFACT_TYPES,
  },
  blocks: {
    stateful: ['dashboard', 'data-table'],
    aiContext: ['chart', 'dashboard'],
  },
  commands: [
    'dashboard',
    'mosaic-dashboard',
    'block-document',
    'cli-block-document',
  ],
  ai: {
    instructionSets: ['stable'],
    topLevelToolGroups: [
      'default-data-analysis',
      'artifact-context',
      'dashboard-agent',
      'worksheet-agent',
      'webcontainer',
      'chart',
      'chart-image-for-markdown',
    ],
    nestedAgents: ['dashboard', 'worksheet', 'worksheet-dashboard'],
  },
  skills: [],
  dashboard: {deckMaps: false},
} as const satisfies CliCapabilityProfile;
