import {tool} from 'ai';
import {z} from 'zod';
import type {DashboardAiAdapter, DashboardAiStore} from './types';

const DashboardCreateArtifactToolParameters = z.object({
  title: z.string().optional(),
  layoutType: z
    .enum(['dock', 'grid'])
    .optional()
    .default('grid')
    .describe('Dashboard layout node type to use at creation time.'),
});
type DashboardCreateArtifactToolParameters = z.infer<
  typeof DashboardCreateArtifactToolParameters
>;

export function createDashboardArtifactTool<TState>(
  store: DashboardAiStore<TState>,
  adapter: DashboardAiAdapter<TState>,
) {
  return tool({
    description:
      'Create a new dashboard artifact with a dock or grid layout and make it the active artifact. Use when no dashboard artifact exists yet.',
    inputSchema: DashboardCreateArtifactToolParameters,
    execute: async (params: DashboardCreateArtifactToolParameters, context) => {
      const state = store.getState();
      const artifactId = adapter.createDashboardArtifact(
        state,
        params.title,
        params.layoutType,
      );
      adapter.setCurrentArtifact(state, artifactId);
      adapter.makeDashboardPrimaryForRun?.(state, artifactId, context);
      return {
        llmResult: {
          success: true,
          details: `Created dashboard artifact "${artifactId}".`,
          data: {artifactId},
        },
      };
    },
  });
}
