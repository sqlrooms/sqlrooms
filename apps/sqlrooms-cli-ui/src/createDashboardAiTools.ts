import {tool} from 'ai';
import {z} from 'zod';
import {
  createHistogramAiTool,
  createLineChartAiTool,
  createCountPlotAiTool,
  createHeatmapAiTool,
  createBubbleChartAiTool,
  createBoxPlotAiTool,
  createEcdfAiTool,
} from '@sqlrooms/mosaic';
import {RoomState} from './store-types';
import {getErrorMessage} from './utils';
import {toVgPlotSpecString} from './vgplot';
import {StoreApi} from 'zustand';
import {createChartToolDeps} from './createChartToolDeps';

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

const DashboardGetVgPlotToolParameters = z
  .object({
    artifactId: z.string().optional(),
  })
  .default({});
type DashboardGetVgPlotToolParameters = z.infer<
  typeof DashboardGetVgPlotToolParameters
>;

const DashboardSetVgPlotToolParameters = z.object({
  artifactId: z
    .string()
    .optional()
    .describe('Optional target dashboard artifact ID.'),
  vgplot: z
    .union([z.string(), z.object({}).passthrough()])
    .describe('Dashboard vgplot specification as JSON string or object.'),
  createArtifactIfMissing: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      'If true and no dashboard artifact is selected, create one automatically.',
    ),
});
type DashboardSetVgPlotToolParameters = z.infer<
  typeof DashboardSetVgPlotToolParameters
>;

export const DASHBOARD_AI_INSTRUCTIONS = `
Dashboard authoring:
- Use the dashboard chart tools to create charts (create_dashboard_histogram, create_dashboard_line_chart, etc.).
- Each chart type has its own tool with specific parameters.
- For line charts with aggregation, use yFields array with {field: string, aggregate: "sum"|"avg"|"min"|"max"}.
- Set xInterval for temporal binning (year, month, day, hour, etc.).
- Use \`set_dashboard_vgplot\` with complete JSON only when no chart tool fits your needs.
- When calling \`create_dashboard_artifact\`, \`layoutType\` may be \`grid\` or \`dock\`; omitted values default to \`grid\`.
- Ensure specs are valid JSON objects compatible with https://idl.uw.edu/mosaic/schema/latest.json.
`;

export function getDashboardAiInstructions(_store: StoreApi<RoomState>) {
  return DASHBOARD_AI_INSTRUCTIONS.trim();
}

export function createDashboardAiTools(store: StoreApi<RoomState>) {
  const deps = createChartToolDeps(store);

  return {
    create_dashboard_artifact: tool({
      description:
        'Create a new dashboard artifact with a dock or grid layout and make it the active artifact. Use when no dashboard artifact exists yet.',
      inputSchema: DashboardCreateArtifactToolParameters,
      execute: async (params: DashboardCreateArtifactToolParameters) => {
        const {title, layoutType} = params;
        const state = store.getState();
        const artifactId = state.dashboard.createDashboardArtifact(
          title,
          layoutType,
        );
        state.artifacts.setCurrentArtifact(artifactId);
        return {
          llmResult: {
            success: true,
            details: `Created dashboard artifact "${artifactId}".`,
            data: {artifactId},
          },
        };
      },
    }),
    // Chart tools - one for each chart type
    create_dashboard_histogram: createHistogramAiTool(deps),
    create_dashboard_line_chart: createLineChartAiTool(deps),
    create_dashboard_count_plot: createCountPlotAiTool(deps),
    create_dashboard_heatmap: createHeatmapAiTool(deps),
    create_dashboard_bubble_chart: createBubbleChartAiTool(deps),
    create_dashboard_box_plot: createBoxPlotAiTool(deps),
    create_dashboard_ecdf: createEcdfAiTool(deps),
    get_dashboard_vgplot: tool({
      description:
        'Get the current vgplot JSON spec for a dashboard artifact. If artifactId is omitted, uses the current dashboard artifact.',
      inputSchema: DashboardGetVgPlotToolParameters,
      execute: async (params: DashboardGetVgPlotToolParameters) => {
        const state = store.getState();
        const targetArtifactId =
          params.artifactId ?? state.dashboard.getCurrentDashboardArtifactId();
        if (!targetArtifactId) {
          return {
            llmResult: {
              success: false,
              errorMessage:
                'No dashboard artifact found. Create one with create_dashboard_artifact first.',
            },
          };
        }
        const artifact = state.artifacts.getArtifact(targetArtifactId);
        if (!artifact || artifact.type !== 'dashboard') {
          return {
            llmResult: {
              success: false,
              errorMessage: `Artifact "${targetArtifactId}" is not a dashboard artifact.`,
            },
          };
        }
        state.dashboard.ensureDashboardArtifact(targetArtifactId);
        const vgplot = state.dashboard.getDashboardVgPlot(targetArtifactId);
        return {
          llmResult: {
            success: true,
            details: `Loaded dashboard spec from "${targetArtifactId}".`,
            data: {
              artifactId: targetArtifactId,
              vgplot,
            },
          },
        };
      },
    }),
    set_dashboard_vgplot: tool({
      description:
        'Set the vgplot JSON spec for a dashboard artifact. If artifactId is omitted, updates the current dashboard artifact (or creates one when allowed).',
      inputSchema: DashboardSetVgPlotToolParameters,
      execute: async (params: DashboardSetVgPlotToolParameters) => {
        const state = store.getState();
        let targetArtifactId =
          params.artifactId ?? state.dashboard.getCurrentDashboardArtifactId();
        if (!targetArtifactId && params.createArtifactIfMissing) {
          targetArtifactId = state.dashboard.createDashboardArtifact(
            undefined,
            'grid',
          );
        }
        if (!targetArtifactId) {
          return {
            llmResult: {
              success: false,
              errorMessage:
                'No dashboard artifact available. Set createArtifactIfMissing=true or provide an artifactId.',
            },
          };
        }

        try {
          const vgplotString = toVgPlotSpecString(params.vgplot);
          state.dashboard.setDashboardVgPlot(targetArtifactId, vgplotString);
          state.artifacts.setCurrentArtifact(targetArtifactId);
          return {
            llmResult: {
              success: true,
              details: `Updated dashboard spec for "${targetArtifactId}".`,
              data: {
                artifactId: targetArtifactId,
                vgplot: state.dashboard.getDashboardVgPlot(targetArtifactId),
              },
            },
          };
        } catch (error) {
          return {
            llmResult: {
              success: false,
              errorMessage: getErrorMessage(error),
            },
          };
        }
      },
    }),
  };
}
