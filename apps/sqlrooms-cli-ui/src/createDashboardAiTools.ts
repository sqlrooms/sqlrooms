import {tool} from 'ai';
import {z} from 'zod';

import {
  createDashboardChartTemplateTool,
  getDashboardChartTemplateInstructions,
} from './createDashboardChartTemplateTool';
import {RoomState} from './store-types';
import {getErrorMessage} from './utils';
import {toVgPlotSpecString} from './vgplot';

const DashboardCreateArtifactToolParameters = z
  .object({
    title: z.string().optional(),
  })
  .default({});
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
- Use the dashboard tools to create/update dashboard vgplot specs.
- Prefer \`create_dashboard_chart_from_template\` for simple supported charts.
- Use \`set_dashboard_vgplot\` with complete JSON only when no template fits.
- Ensure specs are valid JSON objects compatible with https://idl.uw.edu/mosaic/schema/latest.json.
- Use SQL against DuckDB tables when deciding fields, filters, and aggregations in the spec.
`;

export function getDashboardAiInstructions(store: {getState: () => RoomState}) {
  return `${DASHBOARD_AI_INSTRUCTIONS.trim()}\n\n${getDashboardChartTemplateInstructions(store)}`;
}

export function createDashboardAiTools(store: {getState: () => RoomState}) {
  return {
    create_dashboard_artifact: tool({
      description:
        'Create a new dashboard artifact and make it the active artifact. Use when no dashboard artifact exists yet.',
      inputSchema: DashboardCreateArtifactToolParameters,
      execute: async (params: DashboardCreateArtifactToolParameters) => {
        const {title} = params;
        const state = store.getState();
        const artifactId = state.dashboard.createDashboardArtifact(title);
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
    create_dashboard_chart_from_template:
      createDashboardChartTemplateTool(store),
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
          targetArtifactId = state.dashboard.createDashboardArtifact();
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
