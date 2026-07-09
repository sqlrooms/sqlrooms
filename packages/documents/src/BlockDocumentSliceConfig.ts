import {z} from 'zod';
import {DocumentAsset} from './DocumentsSliceConfig';

export type BlockDocumentMark = {
  type: string;
  attrs?: Record<string, unknown>;
  [key: string]: unknown;
};

export type BlockDocumentNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: BlockDocumentNode[];
  marks?: BlockDocumentMark[];
  text?: string;
  [key: string]: unknown;
};

export const BlockDocumentMark: z.ZodType<BlockDocumentMark> = z.looseObject({
  type: z.string(),
  attrs: z.record(z.string(), z.unknown()).optional(),
});

export const BlockDocumentNode: z.ZodType<BlockDocumentNode> = z.lazy(() =>
  z.looseObject({
    type: z.string(),
    attrs: z.record(z.string(), z.unknown()).optional(),
    content: z.array(BlockDocumentNode).optional(),
    marks: z.array(BlockDocumentMark).optional(),
    text: z.string().optional(),
  }),
);

export const BlockDocumentContent = z.looseObject({
  type: z.literal('doc'),
  content: z.array(BlockDocumentNode).default([]),
});
export type BlockDocumentContent = z.infer<typeof BlockDocumentContent>;

export const BlockDocument = z.object({
  id: z.string(),
  content: BlockDocumentContent.default({type: 'doc', content: []}),
  assets: z.record(z.string(), DocumentAsset).default({}),
  updatedAt: z.number().default(0),
});
export type BlockDocument = z.infer<typeof BlockDocument>;

export const BlockDocumentsSliceConfig = z.object({
  artifacts: z
    .record(z.string(), BlockDocument)
    .default({})
    .superRefine((artifacts, ctx) => {
      for (const [key, artifact] of Object.entries(artifacts)) {
        if (key !== artifact.id) {
          ctx.addIssue({
            code: 'custom',
            path: [key, 'id'],
            message: `Block document key "${key}" does not match document id "${artifact.id}"`,
          });
        }
      }
    }),
});
export type BlockDocumentsSliceConfig = z.infer<
  typeof BlockDocumentsSliceConfig
>;

type TextContent = Array<{
  type: 'text';
  text: string;
}>;

const BlockDocumentTextBlockBase = {
  id: z.string(),
  intent: z.string().optional(),
};

export const BlockDocumentHeadingBlock = z.object({
  ...BlockDocumentTextBlockBase,
  type: z.literal('heading'),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  text: z.string(),
});

/**
 * A heading block in a block document with level 1, 2, or 3.
 */
export type BlockDocumentHeadingBlock = z.infer<
  typeof BlockDocumentHeadingBlock
>;

export const BlockDocumentParagraphBlock = z.object({
  ...BlockDocumentTextBlockBase,
  type: z.literal('paragraph'),
  text: z.string(),
});

/**
 * A paragraph block in a block document containing plain text.
 */
export type BlockDocumentParagraphBlock = z.infer<
  typeof BlockDocumentParagraphBlock
>;

export const BlockDocumentListBlock = z.object({
  ...BlockDocumentTextBlockBase,
  type: z.literal('list'),
  ordered: z.boolean().optional(),
  items: z.array(z.string()),
});

/**
 * A bullet or ordered list block containing an array of text items.
 */
export type BlockDocumentListBlock = z.infer<typeof BlockDocumentListBlock>;

export const BlockDocumentTodoBlock = z.object({
  ...BlockDocumentTextBlockBase,
  type: z.literal('todo'),
  checked: z.boolean(),
  text: z.string(),
});

/**
 * A todo/task item block with a checked state and text description.
 */
export type BlockDocumentTodoBlock = z.infer<typeof BlockDocumentTodoBlock>;

export const BlockDocumentImageBlock = z.object({
  ...BlockDocumentTextBlockBase,
  type: z.literal('image'),
  assetId: z.string(),
  caption: z.string().optional(),
});

/**
 * An image block referencing a document asset by ID with optional caption.
 */
export type BlockDocumentImageBlock = z.infer<typeof BlockDocumentImageBlock>;

export const BlockDocumentChartImageBlock = z.object({
  ...BlockDocumentTextBlockBase,
  type: z.literal('chartImage'),
  assetId: z.string(),
  caption: z.string().optional(),
});

/**
 * A chart image block referencing a rendered chart asset by ID with optional caption.
 */
export type BlockDocumentChartImageBlock = z.infer<
  typeof BlockDocumentChartImageBlock
>;

export const BlockDocumentChartBlock = z.object({
  ...BlockDocumentTextBlockBase,
  type: z.literal('chart'),
  tableName: z.string(),
  config: z.unknown(),
  selectionGroupId: z.string().optional(),
  caption: z.string().optional(),
});

/**
 * A live chart block with table binding, chart configuration, and optional selection group for interactivity.
 */
export type BlockDocumentChartBlock = z.infer<typeof BlockDocumentChartBlock>;

export const BlockDocumentStatefulBlockBlock = z.object({
  ...BlockDocumentTextBlockBase,
  type: z.literal('statefulBlock'),
  blockType: z.string(),
  blockInstanceId: z.string(),
  ownership: z.enum(['owned', 'shared', 'external']).optional(),
  /** User-facing label shown for the block in the document flow. */
  caption: z.string().optional(),
  /**
   * Table identity this block reads from, for block types that bind to a single
   * table (currently `data-table`). Resolved via `db.findTable`, same as the
   * `chart` block's `tableName`. Other block types leave this unset and keep
   * their data binding inside their own backing state.
   */
  tableName: z.string().optional(),
  height: z.number().optional(),
});

/**
 * A stateful block embedding another block type (e.g., dashboard, data-table) by instance ID with ownership semantics.
 */
export type BlockDocumentStatefulBlockBlock = z.infer<
  typeof BlockDocumentStatefulBlockBlock
>;

export const BlockDocumentBlock = z.discriminatedUnion('type', [
  BlockDocumentHeadingBlock,
  BlockDocumentParagraphBlock,
  BlockDocumentListBlock,
  BlockDocumentTodoBlock,
  BlockDocumentImageBlock,
  BlockDocumentChartImageBlock,
  BlockDocumentChartBlock,
  BlockDocumentStatefulBlockBlock,
]);

/**
 * Union of all block types that can appear in a block document.
 */
export type BlockDocumentBlock = z.infer<typeof BlockDocumentBlock>;

function textContent(text: string): TextContent | undefined {
  return text ? [{type: 'text', text}] : undefined;
}

function textFromNode(node: BlockDocumentNode | undefined): string {
  if (!node?.content) return node?.text ?? '';
  return node.content.map((child) => textFromNode(child)).join('');
}

/** Returns the document-local id attribute for a block document node, if present. */
export function blockDocumentNodeId(node: BlockDocumentNode): string {
  const id = node.attrs?.id;
  return typeof id === 'string' ? id : '';
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

export function createEmptyBlockDocumentContent(): BlockDocumentContent {
  return {type: 'doc', content: []};
}

export function blockDocumentBlockToNode(
  block: BlockDocumentBlock,
): BlockDocumentNode {
  const baseAttrs = {
    id: block.id,
    ...(block.intent !== undefined ? {intent: block.intent} : {}),
  };

  switch (block.type) {
    case 'heading':
      return {
        type: 'heading',
        attrs: {...baseAttrs, level: block.level},
        content: textContent(block.text),
      };
    case 'paragraph':
      return {
        type: 'paragraph',
        attrs: baseAttrs,
        content: textContent(block.text),
      };
    case 'list':
      return {
        type: block.ordered ? 'orderedList' : 'bulletList',
        attrs: baseAttrs,
        content: block.items.map((item) => ({
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: textContent(item),
            },
          ],
        })),
      };
    case 'todo':
      return {
        type: 'taskList',
        attrs: baseAttrs,
        content: [
          {
            type: 'taskItem',
            attrs: {checked: block.checked},
            content: [
              {
                type: 'paragraph',
                content: textContent(block.text),
              },
            ],
          },
        ],
      };
    case 'image':
      return {
        type: 'blockDocumentImage',
        attrs: {
          ...baseAttrs,
          assetId: block.assetId,
          ...(block.caption !== undefined ? {caption: block.caption} : {}),
        },
      };
    case 'chartImage':
      return {
        type: 'blockDocumentChartImage',
        attrs: {
          ...baseAttrs,
          assetId: block.assetId,
          ...(block.caption !== undefined ? {caption: block.caption} : {}),
        },
      };
    case 'chart':
      return {
        type: 'blockDocumentChart',
        attrs: {
          ...baseAttrs,
          tableName: block.tableName,
          config: block.config,
          ...(block.selectionGroupId !== undefined
            ? {selectionGroupId: block.selectionGroupId}
            : {}),
          ...(block.caption !== undefined ? {caption: block.caption} : {}),
        },
      };
    case 'statefulBlock':
      return {
        type: 'blockDocumentStatefulBlock',
        attrs: {
          ...baseAttrs,
          blockType: block.blockType,
          blockInstanceId: block.blockInstanceId,
          ...(block.ownership !== undefined
            ? {ownership: block.ownership}
            : {}),
          ...(block.caption !== undefined ? {caption: block.caption} : {}),
          ...(block.tableName !== undefined
            ? {tableName: block.tableName}
            : {}),
          ...(block.height !== undefined ? {height: block.height} : {}),
        },
      };
  }
}

export function blockDocumentNodeToBlock(
  node: BlockDocumentNode,
): BlockDocumentBlock | undefined {
  const id = blockDocumentNodeId(node);
  if (!id) return undefined;
  const intent = optionalString(node.attrs?.intent);

  switch (node.type) {
    case 'heading': {
      const level = node.attrs?.level;
      return BlockDocumentHeadingBlock.parse({
        id,
        intent,
        type: 'heading',
        level: level === 1 || level === 2 || level === 3 ? level : 1,
        text: textFromNode(node),
      });
    }
    case 'paragraph':
      return {id, intent, type: 'paragraph', text: textFromNode(node)};
    case 'bulletList':
    case 'orderedList':
      return {
        id,
        intent,
        type: 'list',
        ordered: node.type === 'orderedList' ? true : undefined,
        items:
          node.content?.map((item) => textFromNode(item.content?.[0])) ?? [],
      };
    case 'taskList': {
      const item = node.content?.[0];
      return {
        id,
        intent,
        type: 'todo',
        checked: Boolean(item?.attrs?.checked),
        text: textFromNode(item?.content?.[0]),
      };
    }
    case 'blockDocumentImage': {
      const result = BlockDocumentImageBlock.safeParse({
        id,
        intent,
        type: 'image',
        assetId: node.attrs?.assetId,
        caption: optionalString(node.attrs?.caption),
      });
      return result.success ? result.data : undefined;
    }
    case 'blockDocumentChartImage': {
      const result = BlockDocumentChartImageBlock.safeParse({
        id,
        intent,
        type: 'chartImage',
        assetId: node.attrs?.assetId,
        caption: optionalString(node.attrs?.caption),
      });
      return result.success ? result.data : undefined;
    }
    case 'blockDocumentChart': {
      const result = BlockDocumentChartBlock.safeParse({
        id,
        intent,
        type: 'chart',
        tableName: node.attrs?.tableName,
        config: node.attrs?.config,
        selectionGroupId: optionalString(node.attrs?.selectionGroupId),
        caption: optionalString(node.attrs?.caption),
      });
      return result.success ? result.data : undefined;
    }
    case 'blockDocumentStatefulBlock': {
      const result = BlockDocumentStatefulBlockBlock.safeParse({
        id,
        intent,
        type: 'statefulBlock',
        blockType: node.attrs?.blockType,
        blockInstanceId: node.attrs?.blockInstanceId,
        ownership: node.attrs?.ownership,
        caption: optionalString(node.attrs?.caption),
        tableName: optionalString(node.attrs?.tableName),
        height: optionalNumber(node.attrs?.height),
      });
      return result.success ? result.data : undefined;
    }
    default:
      return undefined;
  }
}

export function blockDocumentContentToBlocks(
  content: BlockDocumentContent,
): BlockDocumentBlock[] {
  return content.content
    .map((node) => blockDocumentNodeToBlock(node))
    .filter((block): block is BlockDocumentBlock => Boolean(block));
}
