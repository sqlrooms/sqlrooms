import {z} from 'zod';
import {LayoutDirection} from './common';
import {migrate} from './migrate';

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
// Panel identity — used by panel and dock nodes
// ---------------------------------------------------------------------------

const PanelIdentity = z.union([
  z.string(),
  z.object({
    key: z.string(),
    meta: z.record(z.string(), z.unknown()).optional(),
  }),
]);
export type PanelIdentity = z.infer<typeof PanelIdentity>;

// ---------------------------------------------------------------------------
// Panel node — leaf with optional sizing constraints
// ---------------------------------------------------------------------------

export const LayoutPanelNode = z.object({
  type: z.literal('panel'),
  id: z.string(),
  panel: PanelIdentity.optional(),
  title: z.string().optional(),
  collapsed: z.boolean().optional(),
  ...LayoutNodeSize.shape,
});
export type LayoutPanelNode = z.infer<typeof LayoutPanelNode>;

// ---------------------------------------------------------------------------
// Split node — resizable panel group
// ---------------------------------------------------------------------------

const BaseLayoutSplitNode = z
  .object({
    type: z.literal('split'),
    id: z.string(),
    panel: PanelIdentity.optional(),
    direction: LayoutDirection,
    collapsed: z.boolean().optional(),
    resizable: z.boolean().default(true).optional(),
    ...LayoutNodeSize.shape,
  })
  .strict();

export const LayoutSplitNode = BaseLayoutSplitNode.extend({
  children: z.lazy(() => z.array(LayoutNode)),
}).strict();
export type LayoutSplitNode = z.infer<typeof BaseLayoutSplitNode> & {
  children: LayoutNode[];
};

// ---------------------------------------------------------------------------
// Tabs node — tabbed container
// ---------------------------------------------------------------------------

const BaseLayoutTabsNode = z
  .object({
    type: z.literal('tabs'),
    id: z.string(),
    panel: PanelIdentity.optional(),
    activeTabIndex: z.number(),
    collapsed: z.boolean().optional(),
    hideTabStrip: z.boolean().optional(),
    closedChildren: z.array(z.string()).optional(),
    hiddenChildren: z.array(z.string()).optional(),
    ...LayoutNodeSize.shape,
  })
  .strict();

export const LayoutTabsNode = BaseLayoutTabsNode.extend({
  children: z.lazy(() => z.array(LayoutNode)),
}).strict();

export type LayoutTabsNode = z.infer<typeof BaseLayoutTabsNode> & {
  children: LayoutNode[];
};

// ---------------------------------------------------------------------------
// Dock node — docking workspace with explicit panel identity
// ---------------------------------------------------------------------------

const BaseLayoutDockNode = z.object({
  type: z.literal('dock'),
  id: z.string(),
  panel: PanelIdentity.optional(),
  collapsed: z.boolean().optional(),
  ...LayoutNodeSize.shape,
});

export const LayoutDockNode = BaseLayoutDockNode.extend({
  root: z.lazy(() => LayoutNode),
});

export type LayoutDockNode = z.infer<typeof BaseLayoutDockNode> & {
  root: LayoutNode;
};

// ---------------------------------------------------------------------------
// Grid node — scrollable draggable/resizable dashboard grid
// ---------------------------------------------------------------------------

const LayoutGridCompaction = z.enum(['vertical', 'horizontal']).nullable();

const LayoutGridResizeHandles = z
  .array(z.enum(['n', 'e', 's', 'w', 'se', 'sw', 'nw', 'ne']))
  .optional();

const LayoutGridItem = z
  .object({
    i: z.string(),
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
    minW: z.number().optional(),
    maxW: z.number().optional(),
    minH: z.number().optional(),
    maxH: z.number().optional(),
    static: z.boolean().optional(),
    isDraggable: z.boolean().optional(),
    isResizable: z.boolean().optional(),
    resizeHandles: LayoutGridResizeHandles,
  })
  .strict();
export type LayoutGridItem = z.infer<typeof LayoutGridItem>;

const BaseLayoutGridNode = z.object({
  type: z.literal('grid'),
  id: z.string(),
  panel: PanelIdentity.optional(),
  collapsed: z.boolean().optional(),
  cols: z.union([z.number(), z.record(z.string(), z.number())]).optional(),
  rowHeight: z.number().optional(),
  margin: z.tuple([z.number(), z.number()]).optional(),
  containerPadding: z.tuple([z.number(), z.number()]).optional(),
  compactType: LayoutGridCompaction.optional(),
  preventCollision: z.boolean().optional(),
  isBounded: z.boolean().optional(),
  breakpoints: z.record(z.string(), z.number()).optional(),
  layouts: z.record(z.string(), z.array(LayoutGridItem)).optional(),
  autoSize: z.boolean().optional(),
  resizeHandles: LayoutGridResizeHandles,
  ...LayoutNodeSize.shape,
});

export const LayoutGridNode = z.strictObject({
  ...BaseLayoutGridNode.shape,
  children: z.lazy(() => z.array(LayoutNode)),
});

export type LayoutGridNode = z.infer<typeof BaseLayoutGridNode> & {
  children: LayoutNode[];
};

// ---------------------------------------------------------------------------
// Composite LayoutNode union — accepts legacy formats via preprocess
// ---------------------------------------------------------------------------

export type LayoutNode =
  | LayoutNodeKey
  | LayoutPanelNode
  | LayoutSplitNode
  | LayoutTabsNode
  | LayoutDockNode
  | LayoutGridNode;

export const LayoutNode = z.preprocess(
  migrate,
  z.union([
    LayoutNodeKey,
    LayoutPanelNode,
    LayoutSplitNode,
    LayoutTabsNode,
    LayoutDockNode,
    LayoutGridNode,
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
  return node != null && typeof node === 'object' && node.type === 'panel';
}

export function isLayoutSplitNode(
  node: LayoutNode | null | undefined,
): node is LayoutSplitNode {
  return node != null && typeof node === 'object' && node.type === 'split';
}

export function isLayoutTabsNode(
  node: LayoutNode | null | undefined,
): node is LayoutTabsNode {
  return node != null && typeof node === 'object' && node.type === 'tabs';
}

export function isLayoutDockNode(
  node: LayoutNode | null | undefined,
): node is LayoutDockNode {
  return node != null && typeof node === 'object' && node.type === 'dock';
}
export function isLayoutGridNode(
  node: LayoutNode | null | undefined,
): node is LayoutGridNode {
  return node != null && typeof node === 'object' && node.type === 'grid';
}

// ---------------------------------------------------------------------------
// LayoutConfig — the top-level config is just LayoutNode | null
// ---------------------------------------------------------------------------

export const LayoutConfig = LayoutNode.nullable() as z.ZodType<LayoutConfig>;
export type LayoutConfig = LayoutNode | null;

export function createDefaultLayout(): LayoutConfig {
  return MAIN_VIEW;
}
