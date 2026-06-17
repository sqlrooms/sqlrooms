import {createBlockDocumentCommandIds} from './BlockDocumentCommands';

export const BLOCK_DOCUMENT_AGENT_TOOL_NAME = 'block_document_agent';

export type CreateBlockDocumentAuthoringInstructionsOptions = {
  commandNamespace?: string;
  artifactLabel?: string;
  commandToolName?: string;
  blockDocumentAgentToolName?: string;
};

export function createBlockDocumentAuthoringInstructions({
  commandNamespace = 'block-document',
  artifactLabel = 'Block Document',
  commandToolName = 'execute_command',
  blockDocumentAgentToolName = BLOCK_DOCUMENT_AGENT_TOOL_NAME,
}: CreateBlockDocumentAuthoringInstructionsOptions = {}) {
  const commandIds = createBlockDocumentCommandIds(commandNamespace);
  const artifactLabelLower = artifactLabel.toLowerCase();
  return `
${artifactLabel} authoring:
- Prefer a ${artifactLabel} artifact when the user asks for a narrative, report, notebook-like document, or mixed text/chart output.
- Use ${commandToolName} with ${artifactLabelLower} commands for deterministic edits. The supported command IDs are: ${commandIds.join(', ')}.
- Use ${commandNamespace}.create-chart-block for focused standalone charts that should live directly in the document.
- Use host-specific stateful block tools when available for dashboards, pivots, or other interactive surfaces that need backing feature state.
- Use ${commandNamespace}.create-stateful-block when the host has registered a stateful block type such as dashboard, pivot, or document.
- Give independent standalone chart blocks separate selection groups by default. Reuse selectionGroupId only when the charts should crossfilter together.
- If ${blockDocumentAgentToolName} is available, use it for multi-step ${artifactLabelLower} authoring plans that combine narrative blocks, standalone charts, and hosted stateful blocks.
`.trim();
}

export function createBlockDocumentAiInstructions({
  commandNamespace = 'block-document',
  artifactLabel = 'Block Document',
}: Pick<
  CreateBlockDocumentAuthoringInstructionsOptions,
  'artifactLabel' | 'commandNamespace'
> = {}) {
  return `
${artifactLabel} artifacts:
- Use ${commandNamespace}.list and ${commandNamespace}.get to inspect block-composed documents.
- Use ${commandNamespace}.create to create a new ${artifactLabel.toLowerCase()} artifact.
- Use ${commandNamespace}.append-blocks, ${commandNamespace}.insert-blocks, ${commandNamespace}.update-block, ${commandNamespace}.remove-block, and ${commandNamespace}.move-block for deterministic block edits.
- Use ${commandNamespace}.create-chart-block for standalone Mosaic/vgplot chart blocks.
- Use ${commandNamespace}.create-stateful-block for host-registered dashboards, pivots, documents, or other feature-backed blocks.
`.trim();
}

export type BlockDocumentAgentPlanStep =
  | {
      type: 'create-block-document';
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
      type: 'create-stateful-block';
      artifactId: string;
      blockType: string;
      blockInstanceId?: string;
    };

export type BlockDocumentAgentResult = {
  success: boolean;
  artifactId?: string;
  stepsExecuted: BlockDocumentAgentPlanStep[];
  details?: string;
  errorMessage?: string;
};
