import {
  getLayoutNodeId,
  isLayoutNodeKey,
  LayoutNode,
} from '@sqlrooms/layout-config';
import type {Layout} from 'react-resizable-panels';
import {isCollapsed} from '../utils';

/**
 * Parse a node `defaultSize` into a percentage number, or `undefined` when it
 * is not expressed as a percentage. Explicit `%` values and unitless numeric
 * strings use the percentage semantics of react-resizable-panels. Pixel and
 * other CSS-unit sizes cannot be converted without measuring the container.
 */
export function parsePercentSize(
  size: string | number | undefined,
): number | undefined {
  if (typeof size === 'number') {
    return undefined; // numeric == pixels in this codebase
  }
  if (typeof size === 'string') {
    const normalized = size.trim();
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)%?$/.test(normalized)) {
      return undefined;
    }
    const value = Number.parseFloat(normalized);
    return Number.isFinite(value) ? value : undefined;
  }
  return undefined;
}

/**
 * Whether a node `defaultSize` carries an explicit non-percentage size intent.
 * Such sizes cannot be represented in the group-level percentage-only RRP
 * `Layout`, so a group containing one must not emit a `defaultLayout`.
 */
export function isExplicitNonPercentSize(
  size: string | number | undefined,
): boolean {
  if (typeof size === 'number') {
    return true; // numeric == pixels in this codebase
  }
  return (
    typeof size === 'string' &&
    size.trim().length > 0 &&
    parsePercentSize(size) === undefined
  );
}

/** Whether a declared size is meaningfully different from zero. */
export function isNonZeroSize(size: string | number | undefined): boolean {
  if (size === undefined) return false;
  if (typeof size === 'number') return size !== 0;
  const value = Number.parseFloat(size.trim());
  return !Number.isFinite(value) || value !== 0;
}

/**
 * Derive the group's initial RRP `Layout` ({panelId → percentage}) from the
 * declared node sizes and collapsed flags. Zero-sized collapsed nodes get 0;
 * the rest fill the remaining space proportionally to their `defaultSize`
 * (unset sizes share evenly). This makes RRP paint the correct
 * (already-collapsed) layout on the very first frame instead of flashing the
 * uncollapsed sizes and then imperatively collapsing after mount.
 *
 * Returns `undefined` (so RRP honours each panel's own `defaultSize`) when a
 * visible panel declares an explicit non-percentage size: the group `Layout`
 * is percentage-only, so emitting it would silently rewrite e.g. a 250px or
 * 20rem sidebar to a percentage. A panel that is currently collapsed is not
 * visible, so groups still get their anti-flash layout while it stays
 * collapsed. A non-zero `collapsedSize` also returns `undefined`, because
 * encoding it as zero would discard the declared collapsed width.
 */
export function computeDefaultLayout(
  children: LayoutNode[],
): Layout | undefined {
  if (children.length === 0) {
    return undefined;
  }

  const entries = children.map((child) => {
    const id = getLayoutNodeId(child);
    const collapsed = isCollapsed(child);
    const isKey = isLayoutNodeKey(child);
    const percent = isKey ? undefined : parsePercentSize(child.defaultSize);
    const explicitNonPercentSize = isKey
      ? false
      : isExplicitNonPercentSize(child.defaultSize);
    const collapsedSize = isKey ? undefined : child.collapsedSize;
    return {id, collapsed, percent, explicitNonPercentSize, collapsedSize};
  });

  if (
    entries.some(
      (entry) => entry.collapsed && isNonZeroSize(entry.collapsedSize),
    )
  ) {
    return undefined;
  }

  const visible = entries.filter((entry) => !entry.collapsed);
  if (visible.length === 0) {
    // Degenerate: everything collapsed. Let RRP fall back to per-panel sizing.
    return undefined;
  }

  // A visible explicitly-sized panel cannot be faithfully encoded as a percentage.
  // Defer entirely to per-panel `defaultSize` rather than distort it.
  if (visible.some((entry) => entry.explicitNonPercentSize)) {
    return undefined;
  }

  const knownSum = visible.reduce(
    (sum, entry) => sum + (entry.percent ?? 0),
    0,
  );
  const unknownCount = visible.filter(
    (entry) => entry.percent === undefined,
  ).length;
  const remaining = Math.max(0, 100 - knownSum);
  const perUnknown = unknownCount > 0 ? remaining / unknownCount : 0;

  const rawWeights = new Map<string, number>();
  for (const entry of entries) {
    if (entry.collapsed) {
      rawWeights.set(entry.id, 0);
    } else {
      rawWeights.set(entry.id, entry.percent ?? perUnknown);
    }
  }

  const visibleTotal = visible.reduce(
    (sum, entry) => sum + (rawWeights.get(entry.id) ?? 0),
    0,
  );

  const layout: Layout = {};
  for (const entry of entries) {
    if (entry.collapsed) {
      layout[entry.id] = 0;
    } else if (visibleTotal > 0) {
      layout[entry.id] = ((rawWeights.get(entry.id) ?? 0) / visibleTotal) * 100;
    } else {
      layout[entry.id] = 100 / visible.length;
    }
  }
  return layout;
}
