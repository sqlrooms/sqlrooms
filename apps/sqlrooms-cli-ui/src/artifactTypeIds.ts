export const CLI_ARTIFACT_TYPES = [
  'block-document',
  'dashboard',
  'pivot',
  'notebook',
  'markdown-document',
  'sql-query',
  'html-app',
  'python',
  'canvas',
  'app-builder',
] as const;

export type CliArtifactType = (typeof CLI_ARTIFACT_TYPES)[number];

/** Block types that support the "Ask AI" affordance in the CLI document (v1). */
export const CLI_AI_BLOCK_TYPES = [
  'chart',
  'dashboard',
  'html-app',
  'map',
] as const;

export type CliAiBlockType = (typeof CLI_AI_BLOCK_TYPES)[number];

/** Stateful block artifact types supported by the CLI block-document runtime. */
export const STATEFUL_BLOCK_ARTIFACT_TYPES = [
  'dashboard',
  'pivot',
  'data-table',
  'map',
  'markdown-document',
  'sql-query',
  'html-app',
  'python',
] as const;

/** A stateful block artifact type supported by the CLI. */
export type StatefulBlockArtifactType =
  (typeof STATEFUL_BLOCK_ARTIFACT_TYPES)[number];
