import type {BlockDocumentBlockSummary} from './BlockDocumentAi';
import type {
  BlockDocumentBlock,
  BlockDocumentNode,
} from './BlockDocumentSliceConfig';

/**
 * Extract plain text from an array of BlockDocumentNodes.
 */
function extractTextFromNodes(nodes: BlockDocumentNode[]): string {
  return nodes
    .map((node) => {
      if (node.text) return node.text;
      if (node.content) return extractTextFromNodes(node.content);
      return '';
    })
    .join('');
}

/** Summarize one supported block using the same references as document tools. */
export function summarizeBlockDocumentBlock(
  block: BlockDocumentBlock | undefined,
  index: number,
): BlockDocumentBlockSummary | undefined {
  if (!block) return undefined;

  if (block.type === 'statefulBlock') {
    return {
      blockId: block.id,
      index,
      type: block.type,
      ...(block.caption !== undefined ? {caption: block.caption} : {}),
      ...(block.tableName !== undefined ? {tableName: block.tableName} : {}),
      statefulBlock: {
        blockType: block.blockType,
        ...(block.blockInstanceId !== undefined
          ? {blockInstanceId: block.blockInstanceId}
          : {}),
        ...(block.ownership !== undefined ? {ownership: block.ownership} : {}),
      },
    };
  }

  if (block.type === 'chart') {
    return {
      blockId: block.id,
      index,
      type: block.type,
      tableName: block.tableName,
      ...(block.caption !== undefined ? {caption: block.caption} : {}),
    };
  }

  return {
    blockId: block.id,
    index,
    type: block.type,
    ...('text' in block ? {title: extractTextFromNodes(block.text)} : {}),
    ...('caption' in block && block.caption !== undefined
      ? {caption: block.caption}
      : {}),
  };
}
