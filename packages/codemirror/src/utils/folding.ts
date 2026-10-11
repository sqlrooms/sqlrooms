import {foldEffect, foldable, forceParsing} from '@codemirror/language';
import type {EditorView} from '@codemirror/view';

/**
 * Fold every foldable range in an editor except the first one.
 *
 * For JSON documents this leaves the root object/array open while collapsing
 * nested objects and arrays, which is useful for compact read-only inspectors.
 */
export function foldAllExceptFirstFoldableRange(view: EditorView): void {
  forceParsing(view, view.state.doc.length, 100);

  const effects = [];
  const seenRanges = new Set<string>();
  let skippedRootRange = false;

  for (let lineNumber = 1; lineNumber <= view.state.doc.lines; lineNumber++) {
    const line = view.state.doc.line(lineNumber);
    const range = foldable(view.state, line.from, line.to);
    if (!range) continue;

    const rangeKey = `${range.from}:${range.to}`;
    if (seenRanges.has(rangeKey)) continue;
    seenRanges.add(rangeKey);

    if (!skippedRootRange) {
      skippedRootRange = true;
      continue;
    }

    effects.push(foldEffect.of(range));
  }

  if (effects.length > 0) {
    view.dispatch({effects});
  }
}
