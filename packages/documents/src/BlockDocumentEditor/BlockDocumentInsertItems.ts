import type {Node as ProseMirrorNode} from '@tiptap/pm/model';
import type {Editor} from '@tiptap/react';
import {
  BarChart3Icon,
  CheckSquareIcon,
  Code2Icon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ListIcon,
  ListOrderedIcon,
  MinusIcon,
  PilcrowIcon,
  QuoteIcon,
  Rows3Icon,
} from 'lucide-react';
import type {FC} from 'react';
import type {
  BlockDocumentStatefulBlockCreateNodeOptions,
  BlockDocumentStatefulBlockType,
} from '../BlockDocumentStatefulBlockRendererContext';

/**
 * A block that can be inserted from the block menu, slash search, or toolbar
 * of a `BlockDocumentEditor`.
 */
export type BlockDocumentInsertItem = {
  /**
   * Stable id for filtering and replacing items, for example `'paragraph'`,
   * `'heading-1'` or `'chart'`. The toolbar looks up its buttons by id.
   */
  id: string;
  /** Menu section: `'text'` for basic text blocks, `'insert'` for embeds. */
  group: 'text' | 'insert';
  /** User-facing name shown in menus and toolbar tooltips. */
  label: string;
  /** Short description shown next to the item and used by slash search. */
  description: string;
  /** Icon shown in menus and the toolbar. */
  icon: FC<{className?: string}>;
  /** Select the inserted node as a block after inserting it. */
  selectAfterInsert?: boolean;
  /**
   * Builds the Tiptap JSON node to insert, using `id` as its block id.
   *
   * May return a promise, for example to open a file picker and store an
   * asset first. The editor re-finds its target block once the promise
   * resolves and does nothing if that block is gone. Return (or resolve to)
   * `null` to cancel without changing the document.
   */
  createNode: (
    id: string,
    options?: BlockDocumentStatefulBlockCreateNodeOptions,
  ) => Record<string, unknown> | null | Promise<Record<string, unknown> | null>;
};

/**
 * Returns the built-in insert items in their default order.
 *
 * Hosts can filter, reorder or extend the returned array and pass it to
 * `BlockDocumentEditor` as `insertItems`. The defaults have no Image item,
 * because the package has no upload flow; hosts with one add their own
 * `'image'` item. Items for registered `statefulBlockTypes` are appended by
 * the editor and should not be listed here.
 */
export function createDefaultBlockDocumentInsertItems(): BlockDocumentInsertItem[] {
  return [
    {
      id: 'paragraph',
      group: 'text',
      label: 'Paragraph',
      description: 'Plain text',
      icon: PilcrowIcon,
      createNode: (id) => ({type: 'paragraph', attrs: {id}}),
    },
    ...([1, 2, 3] as const).map(
      (level): BlockDocumentInsertItem => ({
        id: `heading-${level}`,
        group: 'text',
        label: `Heading ${level}`,
        description: `${['Large', 'Medium', 'Small'][level - 1]} section heading`,
        icon: [Heading1Icon, Heading2Icon, Heading3Icon][level - 1]!,
        createNode: (id) => ({
          type: 'heading',
          attrs: {id, level},
          content: [{type: 'text', text: 'Heading'}],
        }),
      }),
    ),
    {
      id: 'bulleted-list',
      group: 'text',
      label: 'Bulleted list',
      description: 'List of items',
      icon: ListIcon,
      createNode: (id) => ({
        type: 'bulletList',
        attrs: {id},
        content: [{type: 'listItem', content: [{type: 'paragraph'}]}],
      }),
    },
    {
      id: 'numbered-list',
      group: 'text',
      label: 'Numbered list',
      description: 'Ordered items',
      icon: ListOrderedIcon,
      createNode: (id) => ({
        type: 'orderedList',
        attrs: {id},
        content: [{type: 'listItem', content: [{type: 'paragraph'}]}],
      }),
    },
    {
      id: 'todo',
      group: 'text',
      label: 'Todo',
      description: 'Task checkbox',
      icon: CheckSquareIcon,
      createNode: (id) => ({
        type: 'taskList',
        attrs: {id},
        content: [
          {
            type: 'taskItem',
            attrs: {checked: false},
            content: [{type: 'paragraph'}],
          },
        ],
      }),
    },
    {
      id: 'quote',
      group: 'text',
      label: 'Quote',
      description: 'Quoted text',
      icon: QuoteIcon,
      createNode: (id) => ({
        type: 'blockquote',
        attrs: {id},
        content: [{type: 'paragraph'}],
      }),
    },
    {
      id: 'code',
      group: 'text',
      label: 'Code',
      description: 'Code block',
      icon: Code2Icon,
      createNode: (id) => ({type: 'codeBlock', attrs: {id}}),
    },
    {
      id: 'divider',
      group: 'insert',
      label: 'Divider',
      description: 'Horizontal rule',
      icon: MinusIcon,
      createNode: (id) => ({type: 'horizontalRule', attrs: {id}}),
    },
    {
      id: 'chart',
      group: 'insert',
      label: 'Chart',
      description: 'Standalone chart block',
      icon: BarChart3Icon,
      createNode: (id) => ({
        type: 'blockDocumentChart',
        attrs: {id, config: {}, caption: ''},
      }),
    },
  ];
}

function labelFromBlockType(blockType: string) {
  return blockType
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** Builds insert items for the registered stateful block types. */
export function createStatefulBlockInsertItems(
  blockTypes: readonly BlockDocumentStatefulBlockType[],
): BlockDocumentInsertItem[] {
  return blockTypes.map((blockType) => {
    const label = blockType.label ?? labelFromBlockType(blockType.blockType);
    return {
      id: `stateful:${blockType.blockType}`,
      group: 'insert',
      label,
      description: blockType.description ?? `Insert ${label}`,
      icon: Rows3Icon,
      selectAfterInsert: true,
      createNode:
        blockType.createNode ??
        ((id: string) => ({
          type: 'blockDocumentStatefulBlock',
          attrs: {
            id,
            blockType: blockType.blockType,
            blockInstanceId: id,
            ownership: 'owned',
            caption: '',
            ...(blockType.resizableHeight
              ? {height: blockType.defaultHeight ?? 560}
              : {}),
          },
        })),
    };
  });
}

/** Where an insert item's node goes. */
export type BlockDocumentInsertTarget =
  | {
      /** Insert at the current selection. */
      kind: 'selection';
    }
  | {
      /** Replace a top-level block. */
      kind: 'replace';
      /** Position of the block when the item was selected (sync path). */
      pos: number;
      /** Id used to re-find the block after an async `createNode`. */
      blockId: string;
      /** Checks that the block found is still the block being replaced. */
      isTarget: (node: ProseMirrorNode) => boolean;
      /**
       * Adjusts the created node for the block being replaced, for example to
       * keep or clear its text. Return `null` to leave the document unchanged.
       */
      prepareNode: (
        node: Record<string, unknown>,
        target: ProseMirrorNode,
      ) => Record<string, unknown> | null;
    };

/** Editors with an async insert in flight; repeat selections are ignored. */
const pendingInsertEditors = new WeakSet<Editor>();

function isPromiseLike<T>(value: T | PromiseLike<T>): value is PromiseLike<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as {then?: unknown}).then === 'function'
  );
}

function findTopLevelBlock(editor: Editor, blockId: string) {
  let found: {pos: number; node: ProseMirrorNode} | null = null;
  editor.state.doc.forEach((node, offset) => {
    if (!found && node.attrs.id === blockId) found = {pos: offset, node};
  });
  return found as {pos: number; node: ProseMirrorNode} | null;
}

function applyInsert(
  editor: Editor,
  item: BlockDocumentInsertItem,
  target: BlockDocumentInsertTarget,
  created: Record<string, unknown> | null,
  findTargetById: boolean,
) {
  if (!created || editor.isDestroyed) return;

  if (target.kind === 'selection') {
    editor.chain().focus().insertContent(created).run();
    return;
  }

  let block: {pos: number; node: ProseMirrorNode} | null;
  if (findTargetById) {
    block = findTopLevelBlock(editor, target.blockId);
  } else {
    const node = editor.state.doc.nodeAt(target.pos);
    block = node ? {pos: target.pos, node} : null;
  }
  if (!block || !target.isTarget(block.node)) return;
  const replacement = target.prepareNode(created, block.node);
  if (!replacement) return;

  const chain = editor
    .chain()
    .focus()
    .insertContentAt(
      {from: block.pos, to: block.pos + block.node.nodeSize},
      replacement,
    );
  if (item.selectAfterInsert) {
    chain.setNodeSelection(block.pos);
  }
  chain.run();
}

/**
 * Inserts an item's node into the editor. This is the one insert path shared
 * by the block menu, slash search and toolbar.
 *
 * A synchronous `createNode` is applied right away and this returns
 * `undefined`. A promise is awaited: further inserts into the same editor are
 * ignored until it settles, the target block is re-found by `blockId` (not by
 * its old position), `null` cancels, and a rejection is logged without
 * changing the document. In that case the returned promise settles once the
 * insert is done, so callers can close their menus right away. While another
 * insert is pending this returns `undefined` without calling `createNode`.
 */
export function insertBlockDocumentItem({
  editor,
  item,
  nodeId,
  createNodeOptions,
  target,
}: {
  editor: Editor;
  item: BlockDocumentInsertItem;
  nodeId: string;
  createNodeOptions?: BlockDocumentStatefulBlockCreateNodeOptions;
  target: BlockDocumentInsertTarget;
}): Promise<void> | undefined {
  if (pendingInsertEditors.has(editor)) return undefined;

  const created = item.createNode(nodeId, createNodeOptions);
  if (!isPromiseLike(created)) {
    applyInsert(editor, item, target, created, false);
    return undefined;
  }

  pendingInsertEditors.add(editor);
  return Promise.resolve(created)
    .then((node) => applyInsert(editor, item, target, node, true))
    .catch((error: unknown) => {
      console.error(`Failed to insert block for item "${item.id}"`, error);
    })
    .finally(() => {
      pendingInsertEditors.delete(editor);
    });
}
