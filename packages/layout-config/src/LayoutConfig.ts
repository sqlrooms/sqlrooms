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
// Composite LayoutNode union — accepts legacy formats via preprocess
// ---------------------------------------------------------------------------

export type LayoutNode =
  | LayoutNodeKey
  | LayoutPanelNode
  | LayoutSplitNode
  | LayoutTabsNode
  | LayoutDockNode;

export const LayoutNode = z.preprocess(
  migrate,
  z.union([
    LayoutNodeKey,
    LayoutPanelNode,
    LayoutSplitNode,
    LayoutTabsNode,
    LayoutDockNode,
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

// ---------------------------------------------------------------------------
// LayoutConfig — the top-level config is just LayoutNode | null
// ---------------------------------------------------------------------------

export const LayoutConfig = z.preprocess(
  migrate,
  LayoutNode.nullable(),
) as z.ZodType<LayoutConfig>;
export type LayoutConfig = LayoutNode | null;

export function createDefaultLayout(): LayoutConfig {
  return MAIN_VIEW;
}
