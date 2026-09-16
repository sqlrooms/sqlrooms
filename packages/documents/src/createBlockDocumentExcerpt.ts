import type {BlockDocumentNode} from './BlockDocumentSliceConfig';

// Bound structural work as well as text: empty nodes and deeply nested lists
// otherwise bypass the character budget before reaching the Markdown exporter.
const MAX_NODES = 256;
const MAX_DEPTH = 32;
const MARKDOWN_ATTRIBUTES = [
  'level',
  'language',
  'start',
  'checked',
  'align',
  'colspan',
  'rowspan',
  'href',
  'title',
  'caption',
  'assetId',
  'blockType',
  'src',
  'alt',
] as const;

/** Copy a bounded render-only prefix without walking the discarded subtree. */
export function createBlockDocumentExcerpt(
  node: BlockDocumentNode,
  maxChars: number,
): {node: BlockDocumentNode; truncated: boolean} {
  let remainingChars = maxChars;
  let remainingNodes = MAX_NODES;
  let truncated = false;

  function copyText(text: string): string {
    const value = text.slice(0, remainingChars);
    remainingChars -= value.length;
    truncated ||= value.length < text.length;
    return value;
  }

  function copyNode(
    source: BlockDocumentNode,
    depth: number,
  ): BlockDocumentNode | undefined {
    remainingNodes--;
    const copy: BlockDocumentNode = {type: source.type};
    if (source.text !== undefined) copy.text = copyText(source.text);
    if (source.attrs) {
      copy.attrs = {};
      // Only rendering attributes are needed. Never traverse a chart config or
      // other arbitrary backing state while building an excerpt.
      for (const key of MARKDOWN_ATTRIBUTES) {
        const value = source.attrs[key];
        if (typeof value === 'string') copy.attrs[key] = copyText(value);
        else if (typeof value === 'boolean' || typeof value === 'number') {
          copy.attrs[key] = value;
        }
      }
    }
    if (source.marks?.length) {
      copy.marks = [];
      for (let index = 0; index < source.marks.length; index++) {
        if (remainingNodes <= 0 || remainingChars <= 0) {
          truncated = true;
          break;
        }
        const mark = copyNode(source.marks[index]!, depth);
        if (mark) copy.marks.push(mark);
      }
    }
    if (source.content?.length) {
      copy.content = [];
      for (let index = 0; index < source.content.length; index++) {
        if (remainingNodes <= 0 || remainingChars <= 0 || depth >= MAX_DEPTH) {
          truncated = true;
          break;
        }
        const child = copyNode(source.content[index]!, depth + 1);
        if (child) copy.content.push(child);
      }
      // Do not give the exporter a half-copied list item/table cell whose
      // required children were cut off at the structural budget boundary.
      if (copy.content.length === 0) return undefined;
    }
    return copy;
  }

  return {node: copyNode(node, 0) ?? {type: node.type}, truncated};
}
