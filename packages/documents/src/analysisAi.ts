export const ANALYSIS_AGENT_TOOL_NAME = 'analysis_agent';

export const ANALYSIS_AGENT_COMMAND_IDS = [
  'analysis.list',
  'analysis.get',
  'analysis.create',
  'analysis.append-blocks',
  'analysis.insert-blocks',
  'analysis.update-block',
  'analysis.remove-block',
  'analysis.move-block',
  'analysis.create-chart-block',
  'analysis.embed-dashboard',
] as const;

export type AnalysisAgentCommandId =
  (typeof ANALYSIS_AGENT_COMMAND_IDS)[number];

export type CreateAnalysisAuthoringInstructionsOptions = {
  commandToolName?: string;
  analysisAgentToolName?: string;
};

export function createAnalysisAuthoringInstructions({
  commandToolName = 'execute_command',
  analysisAgentToolName = ANALYSIS_AGENT_TOOL_NAME,
}: CreateAnalysisAuthoringInstructionsOptions = {}) {
  return `
Analysis authoring:
- Prefer an Analysis artifact when the user asks for a narrative, report, notebook-like document, or mixed text/chart/dashboard output.
- Use ${commandToolName} with analysis commands for deterministic edits. The supported command IDs are: ${ANALYSIS_AGENT_COMMAND_IDS.join(', ')}.
- Use analysis.create-chart-block for focused standalone charts that should live directly in the document.
- Use analysis.embed-dashboard when a multi-panel interactive dashboard is useful; this creates or references a dashboard artifact block.
- Give independent standalone chart blocks separate selection groups by default. Reuse selectionGroupId only when the charts should crossfilter together.
- Embedded dashboards keep their own dashboard-scoped crossfilter state; do not reuse standalone chart selection groups for dashboard embeds.
- If ${analysisAgentToolName} is available, use it for multi-step analysis authoring plans that combine narrative blocks, standalone charts, and dashboard embeds.
`.trim();
}

export type AnalysisAgentPlanStep =
  | {
      type: 'create-analysis';
      title?: string;
    }
  | {
      type: 'append-blocks';
      artifactId: string;
      blockCount: number;
    }
  | {
      type: 'create-chart-block';
      artifactId: string;
      tableName: string;
      selectionGroupId?: string;
    }
  | {
      type: 'embed-dashboard';
      artifactId: string;
      dashboardArtifactId?: string;
      dashboardTitle?: string;
    };

export type AnalysisAgentResult = {
  success: boolean;
  analysisArtifactId?: string;
  stepsExecuted: AnalysisAgentPlanStep[];
  details?: string;
  errorMessage?: string;
};
