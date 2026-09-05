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
 * Resolves a visual block node to a data URL (e.g. a base64 PNG) used as the
 * Markdown image source. Returning `undefined` keeps the node's placeholder
 * src. The resolver is called synchronously per block; callers that need
 * async work (DOM capture, asset lookup) should precompute the URLs and look
 * them up by the node's `id` attribute here.
 */
export type BlockDocumentDataUrlResolver = (
  node: JSONContent,
) => string | undefined;

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
 * caption survives a paste into any Markdown renderer. The src is either a
 * caller-supplied data URL (real pixels) or a stable placeholder (asset id or
 * block type) when no data URL is available.
 */
function createVisualBlockMarkdownNode(options: {
  name: string;
  alt: (node: JSONContent) => string;
  src: (node: JSONContent) => string;
  resolveDataUrl?: BlockDocumentDataUrlResolver;
}) {
  return Node.create({
    name: options.name,
    group: 'block',
    atom: true,
    renderMarkdown: (node) => {
      const caption = optionalString(node.attrs?.caption)?.trim();
      const alt = caption || options.alt(node);
      const dataUrl = options.resolveDataUrl?.(node);
      const src = dataUrl ?? options.src(node);
      return `![${alt}](${src})`;
    },
  });
}

function createBlockDocumentMarkdownManager(
  resolveDataUrl: BlockDocumentDataUrlResolver | undefined,
): MarkdownManager {
  return new MarkdownManager({
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
      createVisualBlockMarkdownNode({
        name: 'blockDocumentImage',
        alt: () => 'Image',
        src: (node) => optionalString(node.attrs?.assetId) ?? 'image',
        resolveDataUrl,
      }),
      createVisualBlockMarkdownNode({
        name: 'blockDocumentChartImage',
        alt: () => 'Chart image',
        src: (node) => optionalString(node.attrs?.assetId) ?? 'chart-image',
        resolveDataUrl,
      }),
      createVisualBlockMarkdownNode({
        name: 'blockDocumentChart',
        alt: () => 'Chart',
        src: () => 'chart',
        resolveDataUrl,
      }),
      createVisualBlockMarkdownNode({
        name: 'blockDocumentStatefulBlock',
        alt: (node) => optionalString(node.attrs?.blockType) ?? 'Block',
        src: (node) => optionalString(node.attrs?.blockType) ?? 'block',
        resolveDataUrl,
      }),
    ],
  });
}

/**
 * Lazily-built {@link MarkdownManager} for block document content. The manager
 * is stateless for serialization (only `parse` mutates it), so a single
 * instance is safe to reuse across calls. When a data URL resolver is provided
 * the manager is rebuilt so the custom nodes can close over it — that cost is
 * negligible for the occasional copy action that supplies real pixels.
 */
let markdownManager: MarkdownManager | undefined;
function getMarkdownManager(
  resolveDataUrl: BlockDocumentDataUrlResolver | undefined,
): MarkdownManager {
  if (!resolveDataUrl) {
    if (!markdownManager) {
      markdownManager = createBlockDocumentMarkdownManager(undefined);
    }
    return markdownManager;
  }
  return createBlockDocumentMarkdownManager(resolveDataUrl);
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
 * When `options.resolveDataUrl` returns a data URL for a visual block, that
 * data URL is used as the image src instead of the placeholder — this is how
 * real chart/map/image pixels can be embedded in the copied Markdown.
 *
 * When `options.title` is provided it is prepended as an `# <title>` heading,
 * since stored block document content does not include the title node.
 */
export function blockDocumentToMarkdown(
  content: BlockDocumentContent,
  options: {
    title?: string;
    resolveDataUrl?: BlockDocumentDataUrlResolver;
  } = {},
): string {
  const body = getMarkdownManager(options.resolveDataUrl).serialize(content);
  const title = options.title?.trim();
  if (!title) {
    return body;
  }
  const titleMarkdown = `# ${title}`;
  return body ? `${titleMarkdown}\n\n${body}` : titleMarkdown;
}
