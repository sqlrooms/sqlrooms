import type {Tool} from 'ai';
import type {BlockDocumentAiAdapter} from './BlockDocumentAiAdapter';

/**
 * Generic result type for block document agent operations.
 */
export type BlockDocumentAgentResult = {
  success: boolean;
  finalOutput: string;
  blockDocumentId: string;
  error?: string;
  metadata?: {
    tokensUsed?: number;
    duration?: number;
    [key: string]: unknown;
  };
};

/**
 * Summary of a block document block for listing operations.
 * Provides generic representation that works across different block types.
 */
export type BlockDocumentBlockSummary = {
  blockId: string;
  type: string;
  title?: string;
  caption?: string;
  tableName?: string;
  statefulBlock?: {
    blockType: string;
    blockInstanceId?: string;
    ownership?: 'owned' | 'external';
  };
};

/**
 * Parameters passed to extra block document AI tools factory.
 * Provides adapters and context for creating custom tools.
 */
export type ExtraBlockDocumentAiToolsParams = {
  blockDocumentId: string;
  blockDocumentAdapter: BlockDocumentAiAdapter;
  databaseAdapter: unknown;
};

/**
 * Factory function for creating additional block document AI tools.
 * Allows hosts to register custom tools that extend capabilities.
 */
export type ExtraBlockDocumentAiToolsFactory = (
  params: ExtraBlockDocumentAiToolsParams,
) => Record<string, Tool>;
