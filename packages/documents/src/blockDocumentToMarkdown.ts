import {Node, type JSONContent} from '@tiptap/core';
import Link from '@tiptap/extension-link';
import {Table} from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import {MarkdownManager} from '@tiptap/markdown';
import StarterKit from '@tiptap/starter-kit';
import type {BlockDocumentContent} from './BlockDocumentSliceConfig';

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/**
 * Serialization-only node for the block document title. The editor injects the
 * title as a `blockDocumentTitle` node; stored content keeps it separate, so
 * callers pass the artifact title via {@link blockDocumentToMarkdown} options.
 */
const BlockDocumentTitleMarkdownNode = Node.create({
  name: 'blockDocumentTitle',
  group: 'block',
  content: 'inline*',
  renderMarkdown: (node, h) => {
    const text = h.renderChildren(node.content ?? []);
    return text ? `# ${text}` : '';
  },
});

/**
 * Serialization-only node for image-style blocks (images, chart images, charts,
 * and stateful blocks). Visual blocks become image-style Markdown so their
 * caption survives a paste into any Markdown renderer; the src is a stable
 * placeholder (asset id or block type) rather than a data URL.
 */
function createVisualBlockMarkdownNode(options: {
  name: string;
  alt: (node: JSONContent) => string;
  src: (node: JSONContent) => string;
}) {
  return Node.create({
    name: options.name,
    group: 'block',
    atom: true,
    renderMarkdown: (node) => {
      const caption = optionalString(node.attrs?.caption)?.trim();
      const alt = caption || options.alt(node);
      return `![${alt}](${options.src(node)})`;
    },
  });
}

const BlockDocumentImageMarkdownNode = createVisualBlockMarkdownNode({
  name: 'blockDocumentImage',
  alt: () => 'Image',
  src: (node) => optionalString(node.attrs?.assetId) ?? 'image',
});

const BlockDocumentChartImageMarkdownNode = createVisualBlockMarkdownNode({
  name: 'blockDocumentChartImage',
  alt: () => 'Chart image',
  src: (node) => optionalString(node.attrs?.assetId) ?? 'chart-image',
});

const BlockDocumentChartMarkdownNode = createVisualBlockMarkdownNode({
  name: 'blockDocumentChart',
  alt: () => 'Chart',
  src: () => 'chart',
});

const BlockDocumentStatefulBlockMarkdownNode = createVisualBlockMarkdownNode({
  name: 'blockDocumentStatefulBlock',
  alt: (node) => optionalString(node.attrs?.blockType) ?? 'Block',
  src: (node) => optionalString(node.attrs?.blockType) ?? 'block',
});

let markdownManager: MarkdownManager | undefined;

/**
 * Lazily-built {@link MarkdownManager} for block document content. The manager
 * is stateless for serialization (only `parse` mutates it), so a single
 * instance is safe to reuse across calls.
 */
function getBlockDocumentMarkdownManager(): MarkdownManager {
  if (!markdownManager) {
    markdownManager = new MarkdownManager({
      extensions: [
        StarterKit.configure({link: false}),
        Link.configure({openOnClick: false}),
        TaskList,
        TaskItem.configure({nested: true}),
        Table.configure({resizable: true}),
        TableRow,
        TableHeader,
        TableCell,
        BlockDocumentTitleMarkdownNode,
        BlockDocumentImageMarkdownNode,
        BlockDocumentChartImageMarkdownNode,
        BlockDocumentChartMarkdownNode,
        BlockDocumentStatefulBlockMarkdownNode,
      ],
    });
  }
  return markdownManager;
}

/**
 * Serialize a block document's Tiptap JSON content to Markdown.
 *
 * Standard nodes (headings, paragraphs, lists, tasks, tables, code, marks) are
 * rendered by `@tiptap/markdown`. The block document's custom nodes render as
 * follows:
 * - `blockDocumentTitle` → `# <text>`
 * - `blockDocumentImage` / `blockDocumentChartImage` → `![<caption>](<assetId>)`
 * - `blockDocumentChart` → `![<caption>](chart)`
 * - `blockDocumentStatefulBlock` → `![<caption>](<blockType>)` (e.g. a map
 *   block becomes `![Store locations](map)`)
 *
 * When `options.title` is provided it is prepended as an `# <title>` heading,
 * since stored block document content does not include the title node.
 */
export function blockDocumentToMarkdown(
  content: BlockDocumentContent,
  options?: {title?: string},
): string {
  const body = getBlockDocumentMarkdownManager().serialize(content);
  const title = options?.title?.trim();
  if (!title) {
    return body;
  }
  const titleMarkdown = `# ${title}`;
  return body ? `${titleMarkdown}\n\n${body}` : titleMarkdown;
}
