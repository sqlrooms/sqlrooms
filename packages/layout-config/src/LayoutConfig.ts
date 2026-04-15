import {z} from 'zod';
import {LayoutDirection} from './common';
import {LayoutMosaicSubNode} from './LayoutMosaicSubNode';

/** Main view room panel key */
export const MAIN_VIEW = 'main';

export const LayoutNodeKey = z.string();
export type LayoutNodeKey = z.infer<typeof LayoutNodeKey>;

const LayoutSize = z.union([z.number(), z.string()]);

export const LayoutNodeSize = z.object({
  defaultSize: LayoutSize.optional(),
  minSize: LayoutSize.optional(),
  maxSize: LayoutSize.optional(),
  collapsedSize: LayoutSize.optional(),
  collapsible: z.boolean().optional(),
});
export type LayoutNodeSize = z.infer<typeof LayoutNodeSize>;

// ---------------------------------------------------------------------------
// Panel node — leaf with optional sizing constraints
// ---------------------------------------------------------------------------

export const LayoutPanelNode = z.object({
  type: z.literal('panel'),
  id: z.string(),
  title: z.string().optional(),
  collapsed: z.boolean().optional(),
  ...LayoutNodeSize.shape,
});
export type LayoutPanelNode = z.infer<typeof LayoutPanelNode>;

// ---------------------------------------------------------------------------
// Split node — resizable panel group
// ---------------------------------------------------------------------------

const BaseLayoutSplitNode = z.object({
  type: z.literal('split'),
  id: z.string(),
  direction: LayoutDirection,
  draggable: z.boolean().optional(),
  collapsed: z.boolean().optional(),
  resizable: z.boolean().default(true).optional(),
  ...LayoutNodeSize.shape,
});

export const LayoutSplitNode = BaseLayoutSplitNode.extend({
  children: z.lazy(() => z.array(LayoutNode)),
});
export type LayoutSplitNode = z.infer<typeof BaseLayoutSplitNode> & {
  children: LayoutNode[];
};

// ---------------------------------------------------------------------------
// Tabs node — tabbed container
// ---------------------------------------------------------------------------

const BaseLayoutTabsNode = z.object({
  type: z.literal('tabs'),
  id: z.string(),
  activeTabIndex: z.number(),
  collapsed: z.boolean().optional(),
  draggable: z.boolean().optional(),
  hideTabStrip: z.boolean().optional(),
  closedChildren: z.array(z.string()).optional(),
  hiddenChildren: z.array(z.string()).optional(),
  ...LayoutNodeSize.shape,
});

export const LayoutTabsNode = BaseLayoutTabsNode.extend({
  children: z.lazy(() => z.array(LayoutNode)),
});

export type LayoutTabsNode = z.infer<typeof BaseLayoutTabsNode> & {
  children: LayoutNode[];
};

// ---------------------------------------------------------------------------
// Mosaic node — drag-and-drop sub-layout (rendered via react-mosaic)
// ---------------------------------------------------------------------------

const BaseLayoutMosaicNode = z.object({
  type: z.literal('mosaic'),
  id: z.string(),
  draggable: z.boolean().optional(),
  direction: LayoutDirection.optional(),
  collapsed: z.boolean().optional(),
  ...LayoutNodeSize.shape,
});

export const LayoutMosaicNode = BaseLayoutMosaicNode.extend({
  layout: z.lazy(() => LayoutMosaicSubNode.nullable()),
});

export type LayoutMosaicNode = z.infer<typeof BaseLayoutMosaicNode> & {
  layout: LayoutMosaicSubNode | null;
};

// ---------------------------------------------------------------------------
// Legacy types — for migration only
// ---------------------------------------------------------------------------

interface LegacyBinaryNode {
  direction: LayoutDirection;
  first: unknown;
  second: unknown;
  splitPercentage?: number;
}

/**
 * Recursively migrate legacy layout formats to the current schema.
 * Handles:
 * 1. Legacy binary tree (v6): { first, second, direction } -> { type: 'split', children }
 * 2. Outer wrapper unwrap: { type: 'mosaic', nodes } -> nodes (the inner tree)
 * 3. Legacy tabs prop: { type: 'tabs', tabs: [...] } -> { type: 'tabs', children: [...] }
 * 4. Strip removed fields: splitPercentages, savedPercentages
 */
function convertLegacyNode(node: unknown): unknown {
  if (typeof node === 'string' || node == null) return node;
  if (typeof node !== 'object') return node;

  const obj = {...node} as Record<string, unknown>;

  // Unwrap the outer { type: 'mosaic', nodes: ... } wrapper
  if (obj.type === 'mosaic' && 'nodes' in obj && !('id' in obj)) {
    return {
      ...(convertLegacyNode(obj.nodes) as Record<string, unknown>),
      id: 'root',
    };
  }

  if (!('id' in node)) {
    obj.id = Math.random().toString(36).substring(2, 15);
  }

  // Already in typed format — apply field migrations
  if (
    'type' in obj &&
    (obj.type === 'split' ||
      obj.type === 'tabs' ||
      obj.type === 'mosaic' ||
      obj.type === 'panel')
  ) {
    let result = obj;

    // Migrate legacy tabs property -> children
    if (obj.type === 'tabs' && 'tabs' in obj && !('children' in obj)) {
      const {tabs, ...rest} = result;
      result = {...rest, children: tabs};
    }

    // Migrate splitPercentages -> per-child defaultSize
    if ('splitPercentages' in result) {
      const pcts = result.splitPercentages as number[] | undefined;
      const children = (result.children ?? []) as unknown[];
      if (Array.isArray(pcts) && Array.isArray(children)) {
        result = {
          ...result,
          children: children.map((child, i) => {
            const size = pcts[i];
            if (size == null) return child;
            if (typeof child === 'string') {
              return {type: 'panel', id: child, defaultSize: `${size}%`};
            }
            if (
              typeof child === 'object' &&
              child != null &&
              !('defaultSize' in (child as Record<string, unknown>))
            ) {
              return {
                ...(child as Record<string, unknown>),
                defaultSize: `${size}%`,
              };
            }
            return child;
          }),
        };
      }
      const {splitPercentages: _sp, ...rest} = result;
      result = rest;
    }

    // Strip other removed fields
    if ('savedPercentages' in result) {
      const {savedPercentages, ...rest} = result;
      result = rest;
    }

    return result;
  }

  // Legacy binary format detected
  if ('first' in obj && 'second' in obj) {
    const legacy = obj as unknown as LegacyBinaryNode;
    return {
      type: 'split' as const,
      direction: legacy.direction,
      children: [
        convertLegacyNode(legacy.first),
        convertLegacyNode(legacy.second),
      ],
    };
  }

  return node;
}

// ---------------------------------------------------------------------------
// Composite LayoutNode union — accepts legacy formats via preprocess
// ---------------------------------------------------------------------------

export type LayoutNode =
  | LayoutNodeKey
  | LayoutPanelNode
  | LayoutSplitNode
  | LayoutTabsNode
  | LayoutMosaicNode;

export const LayoutNode = z.preprocess(
  convertLegacyNode,
  z.union([
    LayoutNodeKey,
    LayoutPanelNode,
    LayoutSplitNode,
    LayoutTabsNode,
    LayoutMosaicNode,
  ]),
) as z.ZodType<LayoutNode>;

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

export function isLayoutNodeKey(node: LayoutNode): node is LayoutNodeKey {
  return typeof node === 'string';
}

export function isLayoutPanelNode(
  node: LayoutNode | null | undefined,
): node is LayoutPanelNode {
  return (
    node != null &&
    typeof node === 'object' &&
    'type' in node &&
    node.type === 'panel'
  );
}

export function isLayoutSplitNode(
  node: LayoutNode | null | undefined,
): node is LayoutSplitNode {
  return (
    node != null &&
    typeof node === 'object' &&
    'type' in node &&
    node.type === 'split'
  );
}

export function isLayoutTabsNode(
  node: LayoutNode | null | undefined,
): node is LayoutTabsNode {
  return (
    node != null &&
    typeof node === 'object' &&
    'type' in node &&
    node.type === 'tabs'
  );
}

export function isLayoutMosaicNode(
  node: LayoutNode | null | undefined,
): node is LayoutMosaicNode {
  return (
    node != null &&
    typeof node === 'object' &&
    'type' in node &&
    node.type === 'mosaic'
  );
}

// ---------------------------------------------------------------------------
// LayoutConfig — the top-level config is just LayoutNode | null
// ---------------------------------------------------------------------------

export const LayoutConfig = z.preprocess(
  convertLegacyNode,
  LayoutNode.nullable(),
) as z.ZodType<LayoutConfig>;
export type LayoutConfig = LayoutNode | null;

export function createDefaultLayout(): LayoutConfig {
  return MAIN_VIEW;
}

// ---------------------------------------------------------------------------
// Deprecated re-exports for backward compatibility
// ---------------------------------------------------------------------------

/** @deprecated Use `LayoutDirection` instead. */
export const MosaicLayoutDirection = LayoutDirection;
/** @deprecated Use `LayoutDirection` instead. */
export type MosaicLayoutDirection = LayoutDirection;

/** @deprecated Use `LayoutNodeKey` instead. */
export const MosaicLayoutNodeKey = LayoutNodeKey;
/** @deprecated Use `LayoutNodeKey` instead. */
export type MosaicLayoutNodeKey = LayoutNodeKey;

/** @deprecated Use `LayoutSplitNode` instead. */
export const MosaicLayoutSplitNode = LayoutSplitNode;
/** @deprecated Use `LayoutSplitNode` instead. */
export type MosaicLayoutSplitNode = LayoutSplitNode;

/** @deprecated Use `LayoutTabsNode` instead. */
export const MosaicLayoutTabsNode = LayoutTabsNode;
/** @deprecated Use `LayoutTabsNode` instead. */
export type MosaicLayoutTabsNode = LayoutTabsNode;

/** @deprecated Use `LayoutMosaicNode` instead. */
export const MosaicLayoutMosaicNode = LayoutMosaicNode;
/** @deprecated Use `LayoutMosaicNode` instead. */
export type MosaicLayoutMosaicNode = LayoutMosaicNode;

/** @deprecated Use `LayoutNode` instead. */
export const MosaicLayoutNode = LayoutNode;
/** @deprecated Use `LayoutNode` instead. */
export type MosaicLayoutNode = LayoutNode;

/** @deprecated Use `isLayoutSplitNode` instead. */
export const isMosaicLayoutSplitNode = isLayoutSplitNode;
/** @deprecated Use `isLayoutTabsNode` instead. */
export const isMosaicLayoutTabsNode = isLayoutTabsNode;
/** @deprecated Use `isLayoutMosaicNode` instead. */
export const isMosaicLayoutMosaicNode = isLayoutMosaicNode;

/** @deprecated Use `isLayoutSplitNode` instead. */
export const isMosaicLayoutParent = isLayoutSplitNode;
/** @deprecated Use `LayoutSplitNode` instead. */
export type MosaicLayoutParent = LayoutSplitNode;
/** @deprecated Use `LayoutSplitNode` instead. */
export const MosaicLayoutParent = LayoutSplitNode;

/** @deprecated Use `createDefaultLayout` instead. */
export const createDefaultMosaicLayout = createDefaultLayout;

/** @deprecated No longer needed — LayoutConfig is now LayoutNode | null directly. */
export const MosaicLayoutConfig = z.object({
  type: z.literal('mosaic'),
  nodes: LayoutNode.nullable(),
});
/** @deprecated No longer needed — LayoutConfig is now LayoutNode | null directly. */
export type MosaicLayoutConfig = z.infer<typeof MosaicLayoutConfig>;

/** @deprecated Use `createDefaultLayout` instead. */
export const DEFAULT_MOSAIC_LAYOUT: MosaicLayoutConfig = {
  type: 'mosaic' as const,
  nodes: MAIN_VIEW,
};

/** @deprecated No longer needed — use LayoutConfig directly. */
export const LayoutTypes = z.enum(['mosaic']);
/** @deprecated No longer needed — use LayoutConfig directly. */
export type LayoutTypes = z.infer<typeof LayoutTypes>;
