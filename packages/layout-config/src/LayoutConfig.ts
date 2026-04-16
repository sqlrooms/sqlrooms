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
// Composite LayoutNode union — accepts legacy formats via preprocess
// ---------------------------------------------------------------------------

export type LayoutNode =
  | LayoutNodeKey
  | LayoutPanelNode
  | LayoutSplitNode
  | LayoutTabsNode;

export const LayoutNode = z.preprocess(
  migrate,
  z.union([LayoutNodeKey, LayoutPanelNode, LayoutSplitNode, LayoutTabsNode]),
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
