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

/** Whether a node is a textblock or contains one (a list, for example). */
function hasTextblock(node: ProseMirrorNode): boolean {
  if (node.isTextblock) return true;
  let found = false;
  node.descendants((child) => {
    if (found) return false;
    if (child.isTextblock) {
      found = true;
      return false;
    }
    return undefined;
  });
  return found;
}

/**
 * Nearest text position to `pos` that stays inside `[rangeStart, rangeEnd]`.
 * Used for text-containing containers: moving the container should keep the
 * endpoint in the same nested paragraph, not jump past the whole container.
 * Returns null when the range holds no text position.
 */
function nearestTextPositionWithin(
  nextDoc: ProseMirrorNode,
  pos: number,
  rangeStart: number,
  rangeEnd: number,
): number | null {
  const clamped = Math.max(rangeStart, Math.min(pos, rangeEnd));
  const $pos = nextDoc.resolve(clamped);
  if ($pos.parent.isTextblock) return clamped;

  const after = Selection.findFrom($pos, 1, true);
  if (after && after.from >= rangeStart && after.from <= rangeEnd) {
    return after.from;
  }
  const before = Selection.findFrom($pos, -1, true);
  if (before && before.from >= rangeStart && before.from <= rangeEnd) {
    return before.from;
  }
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
      if (nextBlock) {
        // The old in-block offset, moved to the block's new position. Positions
        // inside the matched node run from just after its opening token to just
        // before its closing token. Clamping matters when the block got
        // shorter: the old offset could otherwise land in the following block.
        const relative = pos - $pos.before(1);
        const blockStart = nextBlockPos + 1;
        const blockEnd = nextBlockPos + nextBlock.nodeSize - 1;
        const mapped = nextBlockPos + relative;

        if (nextBlock.isTextblock) {
          return Math.max(blockStart, Math.min(mapped, blockEnd));
        }
        if (hasTextblock(nextBlock)) {
          // A list or another text-containing container: keep the endpoint in
          // the same nested paragraph rather than after the whole container.
          const within = nearestTextPositionWithin(
            nextDoc,
            mapped,
            blockStart,
            blockEnd,
          );
          if (within !== null) return within;
        }
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
