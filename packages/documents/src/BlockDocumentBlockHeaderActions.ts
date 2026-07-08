import type {ReactNode} from 'react';

/** Context passed to host-provided block header action renderers. */
export type BlockDocumentBlockHeaderActionsRenderContext = {
  /** The containing block document artifact id. */
  blockDocumentId: string;
  /** The block node id within the block document. */
  blockId: string;
  /** The block type, such as chart, dashboard, html-app, or map. */
  blockType: string;
  /** Optional stateful resource id owned or referenced by the block. */
  blockInstanceId?: string;
};

/**
 * Renders host-provided actions for a block header.
 *
 * Return `null` when the host does not support actions for the supplied block.
 */
export type BlockDocumentBlockHeaderActionsRenderer = (
  ctx: BlockDocumentBlockHeaderActionsRenderContext,
) => ReactNode;
