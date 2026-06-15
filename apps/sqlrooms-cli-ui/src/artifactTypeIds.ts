export const CLI_ARTIFACT_TYPES = [
  'worksheet',
  'dashboard',
  'pivot',
  'notebook',
  'document',
  'sql-query',
  'canvas',
  'app',
] as const;

export type CliArtifactType = (typeof CLI_ARTIFACT_TYPES)[number];
