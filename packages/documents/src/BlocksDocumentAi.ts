import {createBlocksDocumentCommandIds} from './BlocksDocumentCommands';

export const BLOCKS_DOCUMENT_AGENT_TOOL_NAME = 'blocks_document_agent';

export type CreateBlocksDocumentAuthoringInstructionsOptions = {
  commandNamespace?: string;
  artifactLabel?: string;
  commandToolName?: string;
  blocksDocumentAgentToolName?: string;
};

export function createBlocksDocumentAuthoringInstructions({
  commandNamespace = 'blocks-document',
  artifactLabel = 'Blocks Document',
  commandToolName = 'execute_command',
  blocksDocumentAgentToolName = BLOCKS_DOCUMENT_AGENT_TOOL_NAME,
}: CreateBlocksDocumentAuthoringInstructionsOptions = {}) {
  const commandIds = createBlocksDocumentCommandIds(commandNamespace);
  const artifactLabelLower = artifactLabel.toLocaleLowerCase();
  return `
${artifactLabel} authoring:
- Prefer a ${artifactLabel} artifact when the user asks for a narrative, report, notebook-like document, or mixed text/chart/dashboard output.
- Use ${commandToolName} with ${artifactLabelLower} commands for deterministic edits. The supported command IDs are: ${commandIds.join(', ')}.
- Use ${commandNamespace}.create-chart-block for focused standalone charts that should live directly in the document.
- Use ${commandNamespace}.embed-dashboard when a multi-panel interactive dashboard is useful; this creates or references a dashboard artifact block.
- Give independent standalone chart blocks separate selection groups by default. Reuse selectionGroupId only when the charts should crossfilter together.
- Embedded dashboards keep their own dashboard-scoped crossfilter state; do not reuse standalone chart selection groups for dashboard embeds.
- If ${blocksDocumentAgentToolName} is available, use it for multi-step ${artifactLabelLower} authoring plans that combine narrative blocks, standalone charts, and dashboard embeds.
`.trim();
}

export function createBlocksDocumentAiInstructions({
  commandNamespace = 'blocks-document',
  artifactLabel = 'Blocks Document',
}: Pick<
  CreateBlocksDocumentAuthoringInstructionsOptions,
  'artifactLabel' | 'commandNamespace'
> = {}) {
  return `
${artifactLabel} artifacts:
- Use ${commandNamespace}.list and ${commandNamespace}.get to inspect block-composed documents.
- Use ${commandNamespace}.create to create a new ${artifactLabel.toLocaleLowerCase()} artifact.
- Use ${commandNamespace}.append-blocks, ${commandNamespace}.insert-blocks, ${commandNamespace}.update-block, ${commandNamespace}.remove-block, and ${commandNamespace}.move-block for deterministic block edits.
- Use ${commandNamespace}.create-chart-block for standalone Mosaic/vgplot chart blocks.
- Use ${commandNamespace}.embed-dashboard to embed an existing dashboard or create a new embedded dashboard artifact block.
`.trim();
}

export type BlocksDocumentAgentPlanStep =
  | {
      type: 'create-blocks-document';
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

export type BlocksDocumentAgentResult = {
  success: boolean;
  artifactId?: string;
  stepsExecuted: BlocksDocumentAgentPlanStep[];
  details?: string;
  errorMessage?: string;
};
