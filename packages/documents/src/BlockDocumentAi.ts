export const BLOCK_DOCUMENT_AGENT_TOOL_NAME = 'block_document_agent';

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
