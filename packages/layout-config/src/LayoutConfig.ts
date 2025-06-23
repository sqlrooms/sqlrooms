import {z} from 'zod';

/** Main view room panel key */
export const MAIN_VIEW = 'main';

export const LayoutTypes = z.enum(['mosaic']);
export type LayoutTypes = z.infer<typeof MosaicLayoutDirection>;

export const DEFAULT_MOSAIC_LAYOUT: MosaicLayoutConfig = {
  type: LayoutTypes.enum.mosaic,
  nodes: MAIN_VIEW,
};

export const MosaicLayoutDirection = z.enum(['row', 'column']);
export type MosaicLayoutDirection = z.infer<typeof MosaicLayoutDirection>;

const BaseMosaicLayoutParent = z.object({
  direction: MosaicLayoutDirection,
  splitPercentage: z.number().optional(),
});

// See https://zod.dev/?id=recursive-types
export const MosaicLayoutParent: z.ZodType<MosaicLayoutParent> =
  BaseMosaicLayoutParent.extend({
    first: z.lazy(() => MosaicLayoutNode),
    second: z.lazy(() => MosaicLayoutNode),
  });
export type MosaicLayoutParent = z.infer<typeof BaseMosaicLayoutParent> & {
  first: MosaicLayoutNode;
  second: MosaicLayoutNode;
};

export function isMosaicLayoutParent(
  node: MosaicLayoutNode | null | undefined,
): node is MosaicLayoutParent {
  return typeof node !== 'string';
}

export const MosaicLayoutNodeKey = z.string();
export type MosaicLayoutNodeKey = z.infer<typeof MosaicLayoutNodeKey>;

export type MosaicLayoutNode = z.infer<typeof MosaicLayoutNode>;
export const MosaicLayoutNode = z.union([
  MosaicLayoutNodeKey,
  MosaicLayoutParent,
]);

export const MosaicLayoutConfig = z.object({
  type: z.literal(LayoutTypes.enum.mosaic),
  nodes: MosaicLayoutNode.nullable(),
  pinned: z.array(MosaicLayoutNodeKey).optional(),
  fixed: z.array(MosaicLayoutNodeKey).optional(),
});
export type MosaicLayoutConfig = z.infer<typeof MosaicLayoutConfig>;

export const LayoutConfig = z.discriminatedUnion('type', [MosaicLayoutConfig]);
export type LayoutConfig = z.infer<typeof LayoutConfig>;
