export const CLI_ARTIFACT_TYPES = [
  'worksheet',
  'dashboard',
  'pivot',
  'notebook',
  'document',
  'sql-query',
  'html-app',
  'python',
  'canvas',
  'app-builder',
] as const;

export type CliArtifactType = (typeof CLI_ARTIFACT_TYPES)[number];

/** Block types that support the "Ask AI" affordance in the CLI worksheet (v1). */
export const CLI_AI_BLOCK_TYPES = [
  'chart',
  'dashboard',
  'html-app',
  'map',
] as const;
