import type {Tool} from 'ai';
import type {
  BlockDocumentBlock,
  BlockDocumentNode,
} from './BlockDocumentSliceConfig';

export const BLOCK_DOCUMENT_AGENT_TOOL_NAME = 'block_document_agent';

export const KnownDocumentBlockTools = {
  add_text_block: 'add_block_document_text_block',
  list_blocks: 'list_block_document_blocks',
  move_block: 'move_block_document_block',
} as const;

/**
 * Generic adapter for AI tools that mutate or inspect a block document.
 */
export type BlockDocumentAiAdapter = {
  /** Set the current active block document, if the host tracks one. */
  setCurrentBlockDocument(blockDocumentId: string): void;
  /** Ensure the target block document exists before mutation. */
  ensureBlockDocument(blockDocumentId: string): void;
  /** Read the target block document nodes. */
  getBlocks(blockDocumentId: string): BlockDocumentNode[] | undefined;
  /** Append a block to the target block document and return its block ID. */
  addBlock(
    blockDocumentId: string,
    block: BlockDocumentBlock,
  ): string | Promise<string>;
};

/**
 * Narrow adapter for tools that reorder top-level block document blocks.
 */
export type BlockDocumentMoveBlockAiAdapter = Pick<
  BlockDocumentAiAdapter,
  'ensureBlockDocument'
> & {
  /** Move a top-level block to a new zero-based index. */
  moveBlock(
    blockDocumentId: string,
    blockId: string,
    toIndex: number,
  ): boolean | Promise<boolean>;
};

/**
 * Generic summary of a block document block for agent planning.
 */
export type BlockDocumentBlockSummary = {
  blockId: string;
  index: number;
  type: string;
  title?: string;
  caption?: string;
  tableName?: string;
  statefulBlock?: {
    blockType: string;
    blockInstanceId?: string;
    ownership?: 'owned' | 'shared' | 'external';
  };
};

/**
 * Parameters passed to host-provided block document AI tool factories.
 */
export type ExtraBlockDocumentAiToolsParams = {
  /** ID of the block document being edited by this agent run. */
  blockDocumentId: string;
  blockDocumentAdapter: BlockDocumentAiAdapter;
};

/**
 * Factory for host-provided block document AI tools.
 */
export type ExtraBlockDocumentAiToolsFactory = (
  params: ExtraBlockDocumentAiToolsParams,
) => Record<string, Tool>;

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
