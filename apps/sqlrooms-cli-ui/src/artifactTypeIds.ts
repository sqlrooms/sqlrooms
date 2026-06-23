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
