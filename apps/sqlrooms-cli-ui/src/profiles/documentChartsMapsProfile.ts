import type {CliCapabilityProfile} from './types';

/** Document-only production profile with chart and direct map authoring. */
export const DOCUMENT_CHARTS_MAPS_CLI_CAPABILITY_PROFILE = {
  name: 'document-charts-maps',
  version: 1,
  artifacts: {
    creatable: ['block-document'],
    runContext: ['block-document'],
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
      'document-agent',
      'chart',
    ],
    nestedAgents: ['document'],
  },
  skills: [],
  dashboard: {deckMaps: false},
} as const satisfies CliCapabilityProfile;
