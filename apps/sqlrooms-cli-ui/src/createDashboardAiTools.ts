import {tool} from 'ai';
import {z} from 'zod';
import {
  createDefaultChartTypes,
  createChartTools,
  createProfilerTool,
  createTextPanelTool,
  createListPanelsTool,
  createRemovePanelTool,
} from '@sqlrooms/mosaic';
import {RoomState} from './store-types';
import {StoreApi} from 'zustand';
import {createDashboardToolDeps} from './createDashboardToolDeps';

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

export const DASHBOARD_AI_INSTRUCTIONS = `
Dashboard authoring:

**When to use dashboard_agent vs individual tools:**
- Use \`dashboard_agent\` for exploratory requests that require data analysis and discovery:
  - "analyze the earthquakes dataset"
  - "create insights dashboard for sales data"
  - "find interesting patterns in customer behavior"
  - Any request asking to "discover", "explore", "find insights", or "analyze"
- Use individual chart tools for direct, specific requests:
  - "create histogram of magnitude with 20 bins"
  - "add a line chart showing sales over time"
  - "update the histogram to use 30 bins"

**Individual dashboard chart tools:**
- create_dashboard_histogram, create_dashboard_line_chart, create_dashboard_box_plot, create_dashboard_bubble_chart, create_dashboard_count_plot, create_dashboard_heatmap
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
  const deps = createDashboardToolDeps(store);
  const chartTypes = createDefaultChartTypes({includeCustomSpec: false});
  const chartTools = createChartTools(chartTypes, deps);

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
    ...chartTools,
    create_dashboard_profiler: createProfilerTool(deps),
    create_dashboard_text_panel: createTextPanelTool(deps),
    list_dashboard_panels: createListPanelsTool(deps),
    remove_dashboard_panel: createRemovePanelTool(deps),
  };
}
