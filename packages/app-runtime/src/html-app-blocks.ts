import {
  createDefaultBlockDocumentBlockId,
  type BlockDocumentStatefulBlockBlock,
} from '@sqlrooms/documents';

/**
 * Options for creating an HTML app block document block.
 */
export type CreateHtmlAppBlockDocumentBlockOptions = {
  /**
   * Title of the HTML app block (used for caption and title).
   */
  title: string;

  /**
   * Optional natural-language objective for this HTML app block.
   */
  intent?: string;

  /**
   * Height of the block in pixels.
   * @default 560
   */
  height?: number;

  /**
   * Custom app ID. If not provided, a new ID will be generated.
   */
  appId?: string;

  /**
   * Custom block ID. If not provided, a new ID will be generated.
   */
  blockId?: string;
};

/**
 * Creates an HTML app block for use in block documents.
 * This is a pure helper that constructs the block structure without
 * any AI or document management dependencies.
 *
 * @returns Object containing the app ID and the constructed block
 */
export function createHtmlAppBlockDocumentBlock(
  options: CreateHtmlAppBlockDocumentBlockOptions,
): {
  appId: string;
  block: BlockDocumentStatefulBlockBlock;
} {
  const appId = options.appId || createDefaultBlockDocumentBlockId();
  const blockId = options.blockId || createDefaultBlockDocumentBlockId();

  const block: BlockDocumentStatefulBlockBlock = {
    type: 'statefulBlock',
    id: blockId,
    blockType: 'html-app',
    blockInstanceId: appId,
    ownership: 'owned',
    intent: options.intent,
    title: options.title,
    caption: options.title,
    height: options.height ?? 560,
  };

  return {
    appId,
    block,
  };
}
