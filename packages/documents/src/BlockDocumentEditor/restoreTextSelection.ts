import type {Node as ProseMirrorNode} from '@tiptap/pm/model';
import {TextSelection, type Selection} from '@tiptap/pm/state';

function findTopLevelBlockPosition(
  doc: ProseMirrorNode,
  blockId: string,
): number | null {
  let foundPos: number | null = null;
  doc.forEach((node, offset) => {
    if (foundPos === null && node.attrs.id === blockId) {
      foundPos = offset;
    }
  });
  return foundPos;
}

/**
 * Restores a text selection after the editor content is replaced from the
 * store.
 *
 * The selection follows the top-level block it was in, matched by block ID,
 * so an external change that moves that block (for example an append that
 * lands before the trailing empty paragraph) does not move the caret into a
 * different block. Falls back to the previous numeric offsets when the block
 * has no ID or no longer exists.
 */
export function restoreTextSelection(
  selection: Selection,
  nextDoc: ProseMirrorNode,
): TextSelection {
  const maxPos = nextDoc.content.size;
  const clamp = (pos: number) => Math.max(0, Math.min(pos, maxPos));

  const {$from} = selection;
  const blockId = $from.depth > 0 ? $from.node(1).attrs.id : undefined;
  if (typeof blockId === 'string') {
    const nextBlockPos = findTopLevelBlockPosition(nextDoc, blockId);
    if (nextBlockPos !== null) {
      const shift = nextBlockPos - $from.before(1);
      return TextSelection.create(
        nextDoc,
        clamp(selection.from + shift),
        clamp(selection.to + shift),
      );
    }
  }

  return TextSelection.create(
    nextDoc,
    clamp(selection.from),
    clamp(selection.to),
  );
}
