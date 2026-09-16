import {
  blockDocumentNodeToBlock,
  type BlockDocumentContent,
} from './BlockDocumentSliceConfig';
import {blockDocumentToMarkdown} from './blockDocumentToMarkdown';
import type {BlockDocumentBlockSummaryAugmenter} from './createListBlockDocumentBlocksTool';
import {summarizeBlockDocumentBlock} from './summarizeBlockDocumentBlock';
import {createBlockDocumentExcerpt} from './createBlockDocumentExcerpt';

/** Options for a bounded, read-only block document snapshot for AI context. */
export type FormatBlockDocumentContextOptions = {
  /** Maximum output characters, including metadata. Defaults to 24,000; minimum 256. */
  maxChars?: number;
  /** Prioritize this block and its neighbors when the document exceeds the budget. */
  targetBlockId?: string;
  /** Optional host metadata, such as runtime issues, shared with the listing tool. */
  augmentBlockSummary?: BlockDocumentBlockSummaryAugmenter;
};

/**
 * Format document order, stable block references, and Markdown content for an
 * agent. This is a lossy read view, never a document replacement format.
 * Large blocks retain their metadata and a text excerpt; omitted blocks and
 * excerpts are explicitly marked. No assets are resolved or embedded.
 */
export function formatBlockDocumentContext(
  content: BlockDocumentContent,
  {
    maxChars = 24_000,
    targetBlockId,
    augmentBlockSummary,
  }: FormatBlockDocumentContextOptions = {},
): string {
  if (!Number.isInteger(maxChars) || maxChars < 256) {
    throw new RangeError('maxChars must be an integer of at least 256.');
  }

  const nodes = content.content;
  const targetIndex = targetBlockId
    ? nodes.findIndex((node) => node.attrs?.id === targetBlockId)
    : -1;
  const indices = nodes.map((_, index) => index);
  if (targetIndex >= 0) {
    indices.sort(
      (a, b) => Math.abs(a - targetIndex) - Math.abs(b - targetIndex),
    );
  }

  const rows: {index: number; text: string}[] = [];
  // Reserve space for the completeness header and separators.
  let remaining = maxChars - 160;
  let truncated = false;
  for (const index of indices) {
    const node = nodes[index]!;
    const excerpt = createBlockDocumentExcerpt(
      node,
      Math.min(2_000, remaining),
    );
    // Preserve exact resource references, but keep the summary adapter from
    // parsing or flattening unbounded text/list content before serialization.
    const block = blockDocumentNodeToBlock({
      ...excerpt.node,
      attrs: node.attrs,
    });
    const summary = summarizeBlockDocumentBlock(block, index);
    // Text is rendered below, so don't duplicate potentially large titles here.
    const metadata = summary
      ? {...summary, title: undefined, caption: summary.caption?.slice(0, 240)}
      : {index, type: node.type, blockId: node.attrs?.id};
    const metadataTruncated =
      (summary?.caption?.length ?? 0) > 240 ||
      (block?.intent?.length ?? 0) > 240;
    truncated ||= metadataTruncated;
    const coreMetadata = {
      ...metadata,
      ...(block?.intent ? {intent: block.intent.slice(0, 240)} : {}),
      ...(metadataTruncated ? {metadataTruncated: true} : {}),
    };
    const extraMetadata =
      block && summary
        ? augmentBlockSummary?.({block, summary, index})
        : undefined;
    let header = JSON.stringify({...extraMetadata, ...coreMetadata});
    // Host diagnostics must not crowd the edit target out of its own context.
    if (extraMetadata && header.length + 80 > Math.min(remaining, 2_000)) {
      header = JSON.stringify({...coreMetadata, metadataTruncated: true});
      truncated = true;
    }
    if (header.length + 80 > remaining) {
      truncated = true;
      continue;
    }

    const markdown = blockDocumentToMarkdown({
      type: 'doc',
      content: [excerpt.node],
    });
    const limit = Math.min(2_000, remaining - header.length - 80);
    const omitted = excerpt.truncated || markdown.length > limit;
    truncated ||= omitted;
    const text = `${header}\n${markdown.slice(0, limit)}${omitted ? '\n[Block content truncated; read this block for full content.]' : ''}`;
    rows.push({index, text});
    remaining -= text.length + 2;
  }

  rows.sort((a, b) => a.index - b.index);
  return [
    JSON.stringify({
      blockCount: nodes.length,
      omittedBlockCount: nodes.length - rows.length,
      truncated,
    }),
    ...rows.map((row) => row.text),
  ].join('\n\n');
}
