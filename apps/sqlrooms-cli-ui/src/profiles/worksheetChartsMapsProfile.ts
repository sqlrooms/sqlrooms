import type {CliCapabilityProfile} from './types';

/** Worksheet-only production profile with chart and direct map authoring. */
export const WORKSHEET_CHARTS_MAPS_CLI_CAPABILITY_PROFILE = {
  name: 'worksheet-charts-maps',
  version: 1,
  artifacts: {
    creatable: ['worksheet'],
    runContext: ['worksheet'],
  },
  blocks: {
    stateful: ['map'],
    aiContext: ['chart', 'map'],
  },
  commands: ['block-document', 'cli-block-document'],
  ai: {
    instructionSets: ['stable'],
    topLevelToolGroups: [
      'default-data-analysis',
      'artifact-context',
      'worksheet-agent',
      'chart',
    ],
    nestedAgents: ['worksheet'],
  },
  skills: [],
  dashboard: {deckMaps: false},
} as const satisfies CliCapabilityProfile;
