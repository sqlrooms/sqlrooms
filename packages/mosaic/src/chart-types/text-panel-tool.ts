import {tool} from 'ai';
import {z} from 'zod';
import type {DashboardToolDeps} from './base-types';
import {createOrUpdateTextPanel} from './tool-helpers';

export const TextPanelToolParameters = z.object({
  artifactId: z
    .string()
    .optional()
    .describe('Optional dashboard artifact ID. Defaults to current dashboard.'),
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
    .default('Text')
    .describe('Title for the text panel.'),
  content: z
    .string()
    .describe('Markdown content to display in the text panel.'),
  reasoning: z
    .string()
    .describe('Brief rationale for creating the text panel.'),
});

export type TextPanelToolParams = z.infer<typeof TextPanelToolParameters>;

export function createTextPanelTool(deps: DashboardToolDeps) {
  return tool({
    description: `Text panel: displays markdown-formatted text for annotations, insights, explanations, or dashboard headers.

Use when: user asks to "add text", "annotate findings", "add description", "summarize insights", or when you want to provide context for charts.

Supports Markdown: headings, lists, bold, italic, links, code blocks.

Best for: documenting insights discovered during data exploration, adding dashboard titles/sections, explaining chart findings.

To UPDATE an existing text panel: provide the panelId parameter. Otherwise creates new panel.`,
    inputSchema: TextPanelToolParameters,
    execute: async (params) => {
      try {
        const artifactId = deps.resolveArtifact(
          params.artifactId,
          params.createArtifactIfMissing,
        );

        const result = createOrUpdateTextPanel(deps, {
          panelId: params.panelId,
          dashboardId: artifactId,
          title: params.title || 'Text',
          content: params.content,
        });

        return {
          llmResult: {
            success: true,
            details: params.panelId
              ? `Updated text panel "${result.title}".`
              : `Created text panel "${result.title}".`,
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
