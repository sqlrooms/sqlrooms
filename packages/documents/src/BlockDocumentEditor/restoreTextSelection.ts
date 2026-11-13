import type {Node as ProseMirrorNode, ResolvedPos} from '@tiptap/pm/model';
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
 * Maps one selection endpoint into `nextDoc` by following the top-level block
 * it was in, matched by block ID, and keeping its offset within that block.
 * Returns `null` when the block has no ID or no longer exists.
 */
function mapPositionByBlockId(
  $pos: ResolvedPos,
  nextDoc: ProseMirrorNode,
): number | null {
  if ($pos.depth === 0) return null;
  const blockId = $pos.node(1).attrs.id;
  if (typeof blockId !== 'string') return null;
  const nextBlockPos = findTopLevelBlockPosition(nextDoc, blockId);
  if (nextBlockPos === null) return null;
  return nextBlockPos + ($pos.pos - $pos.before(1));
}

/**
 * Restores a text selection after the editor content is replaced from the
 * store.
 *
 * Each endpoint follows the top-level block it was in, matched by block ID,
 * so an external change that moves a block (for example an append that lands
 * before the trailing empty paragraph) does not move the caret into a
 * different block. Endpoints are mapped independently, since the blocks they
 * are in can move by different amounts, and the selection keeps its
 * direction. An endpoint falls back to its previous numeric offset when its
 * block has no ID or no longer exists.
 */
export function restoreTextSelection(
  selection: Selection,
  nextDoc: ProseMirrorNode,
): TextSelection {
  const maxPos = nextDoc.content.size;
  const restore = ($pos: ResolvedPos) =>
    Math.max(
      0,
      Math.min(mapPositionByBlockId($pos, nextDoc) ?? $pos.pos, maxPos),
    );

  return TextSelection.create(
    nextDoc,
    restore(selection.$anchor),
    restore(selection.$head),
  );
}
