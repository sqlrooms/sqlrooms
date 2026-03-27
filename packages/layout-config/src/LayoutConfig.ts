import {z} from 'zod';

/** Main view room panel key */
export const MAIN_VIEW = 'main';

export const LayoutTypes = z.enum(['mosaic']);
export type LayoutTypes = z.infer<typeof LayoutTypes>;

export const MosaicLayoutDirection = z.enum(['row', 'column']);
export type MosaicLayoutDirection = z.infer<typeof MosaicLayoutDirection>;

export const MosaicLayoutNodeKey = z.string();
export type MosaicLayoutNodeKey = z.infer<typeof MosaicLayoutNodeKey>;

// ---------------------------------------------------------------------------
// N-ary tree types (react-mosaic-component v7)
// ---------------------------------------------------------------------------

const BaseMosaicLayoutSplitNode = z.object({
  type: z.literal('split'),
  id: z.string().optional(),
  direction: MosaicLayoutDirection,
  draggable: z.boolean().optional(),
  splitPercentages: z.array(z.number()).optional(),
});

export const MosaicLayoutSplitNode: z.ZodType<MosaicLayoutSplitNode> =
  BaseMosaicLayoutSplitNode.extend({
    children: z.lazy(() => z.array(MosaicLayoutNode)),
  });
export type MosaicLayoutSplitNode = z.infer<
  typeof BaseMosaicLayoutSplitNode
> & {
  children: MosaicLayoutNode[];
};

const BaseMosaicLayoutTabsNode = z.object({
  type: z.literal('tabs'),
  id: z.string().optional(),
  activeTabIndex: z.number(),
  collapsible: z.boolean().optional(),
  collapsed: z.boolean().optional(),
  closeableTabs: z.boolean().optional(),
  creatableTabs: z.boolean().optional(),
  searchableTabs: z.boolean().optional(),
  showTabStrip: z.boolean().optional(),
  showTabStripWhenCollapsed: z.boolean().optional(),
  draggable: z.boolean().optional(),
  savedPercentages: z.array(z.number()).optional(),
});

export const MosaicLayoutTabsNode: z.ZodType<MosaicLayoutTabsNode> =
  BaseMosaicLayoutTabsNode.extend({
    children: z.lazy(() => z.array(MosaicLayoutNode)),
  });
export type MosaicLayoutTabsNode = z.infer<typeof BaseMosaicLayoutTabsNode> & {
  children: MosaicLayoutNode[];
};

const BaseMosaicLayoutMosaicNode = z.object({
  type: z.literal('mosaic'),
  id: z.string(),
  draggable: z.boolean().optional(),
  direction: MosaicLayoutDirection.optional(),
  splitPercentages: z.array(z.number()).optional(),
});

export const MosaicLayoutMosaicNode: z.ZodType<MosaicLayoutMosaicNode> =
  BaseMosaicLayoutMosaicNode.extend({
    nodes: z.lazy(() => MosaicLayoutNode.nullable()),
  });
export type MosaicLayoutMosaicNode = z.infer<
  typeof BaseMosaicLayoutMosaicNode
> & {
  nodes: MosaicLayoutNode | null;
};

// ---------------------------------------------------------------------------
// Legacy binary tree types (react-mosaic-component v6) — for migration only
// ---------------------------------------------------------------------------

interface LegacyMosaicLayoutParent {
  direction: MosaicLayoutDirection;
  first: LegacyMosaicLayoutNode;
  second: LegacyMosaicLayoutNode;
  splitPercentage?: number;
}

type LegacyMosaicLayoutNode = MosaicLayoutNodeKey | LegacyMosaicLayoutParent;

/**
 * Recursively convert a legacy binary mosaic tree node to the new n-ary format.
 * Leaf nodes (strings) pass through unchanged. Already-converted nodes
 * (those with a `type` field) also pass through.
 */
function convertLegacyNode(node: unknown): unknown {
  if (typeof node === 'string' || node == null) return node;
  if (typeof node !== 'object') return node;

  const obj = node as Record<string, unknown>;

  // Already in n-ary format
  if (
    'type' in obj &&
    (obj.type === 'split' || obj.type === 'tabs' || obj.type === 'mosaic')
  ) {
    // Migrate legacy tabs property -> children
    if (obj.type === 'tabs' && 'tabs' in obj && !('children' in obj)) {
      const {tabs, ...rest} = obj;
      return {...rest, children: tabs};
    }
    return node;
  }

  // Legacy binary format detected
  if ('first' in obj && 'second' in obj) {
    const legacy = obj as unknown as LegacyMosaicLayoutParent;
    const splitPercentages =
      legacy.splitPercentage !== undefined
        ? [legacy.splitPercentage, 100 - legacy.splitPercentage]
        : undefined;
    return {
      type: 'split' as const,
      direction: legacy.direction,
      children: [
        convertLegacyNode(legacy.first),
        convertLegacyNode(legacy.second),
      ],
      ...(splitPercentages ? {splitPercentages} : {}),
    };
  }

  return node;
}

// ---------------------------------------------------------------------------
// Composite MosaicLayoutNode — accepts both legacy and n-ary formats via preprocess
// ---------------------------------------------------------------------------

export type MosaicLayoutNode =
  | MosaicLayoutNodeKey
  | MosaicLayoutSplitNode
  | MosaicLayoutTabsNode
  | MosaicLayoutMosaicNode;

export const MosaicLayoutNode: z.ZodType<MosaicLayoutNode> = z.preprocess(
  convertLegacyNode,
  z.union([
    MosaicLayoutNodeKey,
    MosaicLayoutSplitNode,
    MosaicLayoutTabsNode,
    MosaicLayoutMosaicNode,
  ]),
) as z.ZodType<MosaicLayoutNode>;

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

export function isMosaicLayoutSplitNode(
  node: MosaicLayoutNode | null | undefined,
): node is MosaicLayoutSplitNode {
  return (
    node != null &&
    typeof node === 'object' &&
    'type' in node &&
    node.type === 'split'
  );
}

export function isMosaicLayoutTabsNode(
  node: MosaicLayoutNode | null | undefined,
): node is MosaicLayoutTabsNode {
  return (
    node != null &&
    typeof node === 'object' &&
    'type' in node &&
    node.type === 'tabs'
  );
}

export function isMosaicLayoutMosaicNode(
  node: MosaicLayoutNode | null | undefined,
): node is MosaicLayoutMosaicNode {
  return (
    node != null &&
    typeof node === 'object' &&
    'type' in node &&
    node.type === 'mosaic'
  );
}

/**
 * @deprecated Use `isMosaicLayoutSplitNode` instead.
 * Kept for backward compatibility — now checks for `MosaicLayoutSplitNode`.
 */
export function isMosaicLayoutParent(
  node: MosaicLayoutNode | null | undefined,
): node is MosaicLayoutSplitNode {
  return isMosaicLayoutSplitNode(node);
}

/**
 * @deprecated Use `MosaicLayoutSplitNode` instead.
 */
export type MosaicLayoutParent = MosaicLayoutSplitNode;
/**
 * @deprecated Use `MosaicLayoutSplitNode` instead.
 */
export const MosaicLayoutParent: z.ZodType<MosaicLayoutSplitNode> =
  MosaicLayoutSplitNode;

// ---------------------------------------------------------------------------
// Layout config
// ---------------------------------------------------------------------------

export const MosaicLayoutConfig = z.object({
  type: z.literal(LayoutTypes.enum.mosaic),
  nodes: MosaicLayoutNode.nullable(),
  pinned: z.array(MosaicLayoutNodeKey).optional(),
  fixed: z.array(MosaicLayoutNodeKey).optional(),
});
export type MosaicLayoutConfig = z.infer<typeof MosaicLayoutConfig>;

/** @deprecated Use createDefaultMosaicLayout instead */
export const DEFAULT_MOSAIC_LAYOUT: MosaicLayoutConfig = {
  type: LayoutTypes.enum.mosaic,
  nodes: MAIN_VIEW,
};

export function createDefaultMosaicLayout(): MosaicLayoutConfig {
  return {
    type: LayoutTypes.enum.mosaic,
    nodes: MAIN_VIEW,
  };
}

export const LayoutConfig = z.discriminatedUnion('type', [MosaicLayoutConfig]);
export type LayoutConfig = z.infer<typeof LayoutConfig>;
