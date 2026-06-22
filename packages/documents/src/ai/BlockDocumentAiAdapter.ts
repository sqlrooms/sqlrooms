import type {BlockDocumentBlock, BlockDocumentNode} from '../index';

/**
 * Generic adapter interface for block document AI operations.
 * Provides basic operations for managing block documents without
 * any specific artifact or application assumptions.
 */
export type BlockDocumentAiAdapter = {
  /**
   * Set the current active block document (optional).
   * Implementations may use this to update UI state.
   */
  setCurrentBlockDocument?(blockDocumentId: string): void;

  /**
   * Ensure a block document exists.
   * Creates the document if it doesn't exist.
   */
  ensureBlockDocument(blockDocumentId: string): void;

  /**
   * Get all blocks from a block document.
   * Returns undefined if the document doesn't exist.
   */
  getBlocks(blockDocumentId: string): BlockDocumentNode[] | undefined;

  /**
   * Add a block to a block document.
   * Returns the ID of the added block.
   */
  addBlock(blockDocumentId: string, block: BlockDocumentBlock): string;
};
