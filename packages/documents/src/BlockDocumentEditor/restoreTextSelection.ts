import type {Node as ProseMirrorNode} from '@tiptap/pm/model';
import {TextSelection, type Selection} from '@tiptap/pm/state';

/** Position of the top-level node whose `id` attribute is `blockId`, or null. */
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

type ResolvedPos = Selection['$from'];

/**
 * Shift one selection endpoint by the movement of the top-level block it
 * belongs to, matched by block ID, and keep it inside that block's text. Falls
 * back to the original position when the block has no ID, no longer exists, or
 * changed into a node without text.
 */
function shiftedEndpoint(
  pos: number,
  $pos: ResolvedPos,
  nextDoc: ProseMirrorNode,
  maxPos: number,
): number {
  const blockId = $pos.depth > 0 ? $pos.node(1).attrs.id : undefined;
  if (typeof blockId === 'string') {
    const nextBlockPos = findTopLevelBlockPosition(nextDoc, blockId);
    if (nextBlockPos !== null) {
      const nextBlock = nextDoc.nodeAt(nextBlockPos);
      if (nextBlock?.isTextblock) {
        // Positions inside a textblock run from just after its opening token to
        // just after its last character. Clamping matters when the block got
        // shorter: adding the old in-block offset could otherwise land the
        // endpoint inside the following block.
        const blockStart = nextBlockPos + 1;
        const blockEnd = blockStart + nextBlock.content.size;
        return Math.max(
          blockStart,
          Math.min(pos + (nextBlockPos - $pos.before(1)), blockEnd),
        );
      }
    }
  }
  return Math.max(0, Math.min(pos, maxPos));
}

/**
 * Restores a text selection after the editor content is replaced from the
 * store.
 *
 * Each endpoint follows the top-level block it was in, matched by block ID, so
 * an external change that moves those blocks (for example an append that lands
 * before the trailing empty paragraph) does not move the caret into a different
 * block. The endpoints are resolved independently: a selection spanning two
 * blocks can have one block move while the other stays put, and applying the
 * first block's shift to both would move the second endpoint into the wrong
 * block. Falls back to the previous numeric offsets when an endpoint's block has
 * no ID or no longer exists.
 */
export function restoreTextSelection(
  selection: Selection,
  nextDoc: ProseMirrorNode,
): TextSelection {
  const maxPos = nextDoc.content.size;
  const from = shiftedEndpoint(
    selection.from,
    selection.$from,
    nextDoc,
    maxPos,
  );
  const to = shiftedEndpoint(selection.to, selection.$to, nextDoc, maxPos);

  // Reordering can move the block holding `from` past the block holding `to`.
  // Selecting between crossed positions would select every block in between,
  // including ones outside the original selection; collapse instead.
  if (from > to) return TextSelection.create(nextDoc, to);

  return TextSelection.create(nextDoc, from, to);
}
