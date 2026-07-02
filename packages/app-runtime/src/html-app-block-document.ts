import {HTML_APP_BLOCK_TYPE} from './html-app';

/**
 * Block-document stateful block DTO for an owned HTML app runtime.
 *
 * `type` identifies the document block shape, `blockType` identifies the HTML
 * app runtime block, `ownership` records that the document owns the runtime
 * state, and `intent` carries the optional durable app objective.
 */
export type HtmlAppBlockDocumentBlock = {
  type: 'statefulBlock';
  id: string;
  blockType: typeof HTML_APP_BLOCK_TYPE;
  blockInstanceId: string;
  ownership: 'owned';
  intent?: string;
  title: string;
  caption: string;
  height: number;
};

export type CreateHtmlAppBlockDocumentBlockOptions = {
  /** Backing HTML app runtime id. */
  appId: string;
  /** Document block id. Defaults to appId. */
  blockId?: string;
  /** Visible app and block title. */
  title: string;
  /** Optional durable natural-language objective for the app block. */
  intent?: string;
  /** Persisted block height in pixels. */
  height?: number;
};

/**
 * Creates the block-document wrapper for an owned HTML app runtime.
 */
export function createHtmlAppBlockDocumentBlock({
  appId,
  blockId = appId,
  title,
  intent,
  height = 560,
}: CreateHtmlAppBlockDocumentBlockOptions): {
  appId: string;
  block: HtmlAppBlockDocumentBlock;
} {
  return {
    appId,
    block: {
      type: 'statefulBlock',
      id: blockId,
      blockType: HTML_APP_BLOCK_TYPE,
      blockInstanceId: appId,
      ownership: 'owned',
      intent,
      title,
      caption: title,
      height,
    },
  };
}
