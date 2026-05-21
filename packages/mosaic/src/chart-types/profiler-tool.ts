import {tool} from 'ai';
import {z} from 'zod';
import type {DashboardToolDeps} from './base-types';
import {createOrUpdateProfilerPanel} from './tool-helpers';
import {ProfilerPanelConfig} from '../dashboard/core-types';

export const ProfilerToolParameters = z.object({
  artifactId: z
    .string()
    .optional()
    .describe('Optional dashboard artifact ID. Defaults to current dashboard.'),
  tableName: z
    .string()
    .optional()
    .describe('Optional table name. Use when no table is selected yet.'),
  createArtifactIfMissing: z
    .boolean()
    .optional()
    .default(true)
    .describe('If true, create dashboard artifact if missing.'),
  panelId: z
    .string()
    .optional()
    .describe(
      'Optional panel ID. If provided, updates the existing panel instead of creating new one.',
    ),
  title: z
    .string()
    .optional()
    .default('Profiler')
    .describe('Title for the profiler panel.'),
  config: ProfilerPanelConfig,
  reasoning: z.string().describe('Brief rationale for creating the profiler.'),
});

export type ProfilerToolParams = z.infer<typeof ProfilerToolParameters>;

export function createProfilerTool(deps: DashboardToolDeps) {
  return tool({
    description: `Data profiler: displays table schema and statistics for all columns (count, distinct values, min/max, etc.).

Use when: user asks to "profile the data", "show table statistics", "what's in this table", "summarize columns", "give me an overview of the data".

Useful for: quick data exploration, understanding data quality, finding missing values, identifying column types.

To UPDATE an existing profiler: provide the panelId parameter. Otherwise creates new panel.`,
    inputSchema: ProfilerToolParameters,
    execute: async (params) => {
      try {
        const artifactId = deps.resolveArtifact(
          params.artifactId,
          params.createArtifactIfMissing,
        );
        const {tableName} = deps.resolveTable(artifactId, params.tableName);

        const result = createOrUpdateProfilerPanel(deps, {
          panelId: params.panelId,
          dashboardId: artifactId,
          tableName,
          title: params.title || 'Profiler',
          config: params.config,
        });

        return {
          llmResult: {
            success: true,
            details: params.panelId
              ? `Updated profiler "${result.title}".`
              : `Created profiler "${result.title}".`,
            data: result,
          },
        };
      } catch (error) {
        return {
          llmResult: {
            success: false,
            errorMessage:
              error instanceof Error ? error.message : String(error),
          },
        };
      }
    },
  });
}
