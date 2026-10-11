import {CLI_ARTIFACT_TYPES} from '../artifactTypeIds';
import type {CliCapabilityProfile} from './types';

/** Current `--experimental` SQLRooms CLI behavior. */
export const EXPERIMENTAL_CLI_CAPABILITY_PROFILE = {
  name: 'experimental',
  version: 1,
  artifacts: {
    creatable: CLI_ARTIFACT_TYPES,
    runContext: CLI_ARTIFACT_TYPES,
  },
  blocks: {
    stateful: [
      'dashboard',
      'pivot',
      'data-table',
      'map',
      'markdown-document',
      'sql-query',
      'html-app',
      'python',
    ],
    aiContext: ['chart', 'dashboard', 'html-app', 'map'],
  },
  commands: [
    'dashboard',
    'mosaic-dashboard',
    'markdown-document',
    'block-document',
    'cli-block-document',
    'block-document-python',
    'html-app-revision',
  ],
  ai: {
    instructionSets: ['stable', 'experimental'],
    topLevelToolGroups: [
      'default-data-analysis',
      'artifact-context',
      'dashboard-agent',
      'html-app-agent',
      'document-agent',
      'webcontainer',
      'chart',
      'chart-image-for-markdown',
    ],
    nestedAgents: ['dashboard', 'document', 'document-dashboard', 'html-app'],
  },
  skills: [],
  dashboard: {deckMaps: true},
} as const satisfies CliCapabilityProfile;
