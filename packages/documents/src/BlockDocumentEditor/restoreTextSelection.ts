import type {Node as ProseMirrorNode} from '@tiptap/pm/model';
import {Selection, TextSelection} from '@tiptap/pm/state';

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
 * Nearest valid text position to `pos`, preferring the position after it and
 * falling back to the one before. `findFrom(..., true)` skips selectable atoms
 * (charts), which `Selection.near` would return as node selections, so two
 * adjacent charts cannot stop the search between them. Returns null when the
 * document has no textblock at all.
 */
function nearestTextPosition(
  nextDoc: ProseMirrorNode,
  pos: number,
  maxPos: number,
): number | null {
  const clamped = Math.max(0, Math.min(pos, maxPos));
  const $pos = nextDoc.resolve(clamped);
  const after = Selection.findFrom($pos, 1, true);
  if (after) return after.from;
  const before = Selection.findFrom($pos, -1, true);
  if (before) return before.from;
  return null;
}

/**
 * Shift one selection endpoint by the movement of the top-level block it
 * belongs to, matched by block ID, and keep it inside that block's text. Falls
 * back to the nearest text position when the block has no ID, no longer exists,
 * or changed into a node without text, so the endpoint never sits between
 * blocks. Returns null when there is no text position in the document.
 */
function shiftedEndpoint(
  pos: number,
  $pos: ResolvedPos,
  nextDoc: ProseMirrorNode,
  maxPos: number,
): number | null {
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
      if (nextBlock) {
        // The block changed into an atom (a chart, say), which a TextSelection
        // cannot sit inside: use the nearest text position after it.
        return nearestTextPosition(
          nextDoc,
          nextBlockPos + nextBlock.nodeSize,
          maxPos,
        );
      }
    }
  }
  return nearestTextPosition(nextDoc, pos, maxPos);
}

/**
 * Restores a selection after the editor content is replaced from the store.
 *
 * Each endpoint follows the top-level block it was in, matched by block ID, so
 * an external change that moves those blocks (for example an append that lands
 * before the trailing empty paragraph) does not move the caret into a different
 * block. The endpoints are resolved independently: a selection spanning two
 * blocks can have one block move while the other stays put, and applying the
 * first block's shift to both would move the second endpoint into the wrong
 * block. When an endpoint has no text position to land in — its block is gone,
 * changed type, or the document has no textblock — it falls back to the nearest
 * text position, or to a non-text selection near the old caret.
 */
export function restoreTextSelection(
  selection: Selection,
  nextDoc: ProseMirrorNode,
): Selection {
  const maxPos = nextDoc.content.size;
  const from = shiftedEndpoint(
    selection.from,
    selection.$from,
    nextDoc,
    maxPos,
  );
  const to = shiftedEndpoint(selection.to, selection.$to, nextDoc, maxPos);

  if (from === null || to === null) {
    // No textblock anywhere: a TextSelection would be invalid, so keep a
    // valid (possibly node) selection near the previous caret instead.
    const fallbackPos = Math.max(0, Math.min(selection.from, maxPos));
    return Selection.near(nextDoc.resolve(fallbackPos), 1);
  }

  // Reordering can move the block holding `from` past the block holding `to`.
  // Selecting between crossed positions would select every block in between,
  // including ones outside the original selection; collapse instead.
  if (from > to) return TextSelection.create(nextDoc, to);

  return TextSelection.create(nextDoc, from, to);
}
