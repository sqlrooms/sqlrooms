import z from 'zod';
import {LayoutDirection} from './common';

// ---------------------------------------------------------------------------
// Panel sub-node — leaf panel reference within mosaic
// ---------------------------------------------------------------------------

export const LayoutMosaicPanelSubNode = z.string();
export type LayoutMosaicPanelSubNode = z.infer<typeof LayoutMosaicPanelSubNode>;

// ---------------------------------------------------------------------------
// Split sub-node — split within mosaic layout
// ---------------------------------------------------------------------------

const BaseLayoutMosaicSplitSubNode = z.object({
  type: z.literal('split'),
  direction: LayoutDirection,
  splitPercentages: z.array(z.number()).optional(),
});

export const LayoutMosaicSplitSubNode = BaseLayoutMosaicSplitSubNode.extend({
  children: z.lazy(() => z.array(LayoutMosaicSubNode)),
});

export type LayoutMosaicSplitSubNode = z.infer<
  typeof BaseLayoutMosaicSplitSubNode
> & {
  children: LayoutMosaicSubNode[];
};

// ---------------------------------------------------------------------------
// Composite LayoutMosaicSubNode union
// ---------------------------------------------------------------------------

export type LayoutMosaicSubNode =
  | LayoutMosaicPanelSubNode
  | LayoutMosaicSplitSubNode;

export const LayoutMosaicSubNode = z.union([
  LayoutMosaicPanelSubNode,
  LayoutMosaicSplitSubNode,
]) as z.ZodType<LayoutMosaicSubNode>;

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

export function isLayoutMosaicPanelSubNode(
  node: LayoutMosaicSubNode,
): node is LayoutMosaicPanelSubNode {
  return typeof node === 'string';
}

export function isLayoutMosaicSplitSubNode(
  node: LayoutMosaicSubNode,
): node is LayoutMosaicSplitSubNode {
  return typeof node === 'object' && node.type === 'split';
}
