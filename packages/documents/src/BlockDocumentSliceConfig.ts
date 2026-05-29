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

export const BlockDocumentMark: z.ZodType<BlockDocumentMark> = z
  .object({
    type: z.string(),
    attrs: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export const BlockDocumentNode: z.ZodType<BlockDocumentNode> = z.lazy(() =>
  z
    .object({
      type: z.string(),
      attrs: z.record(z.string(), z.unknown()).optional(),
      content: z.array(BlockDocumentNode).optional(),
      marks: z.array(BlockDocumentMark).optional(),
      text: z.string().optional(),
    })
    .passthrough(),
);

export const BlockDocumentContent = z
  .object({
    type: z.literal('doc'),
    content: z.array(BlockDocumentNode).default([]),
  })
  .passthrough();
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
};

export const BlockDocumentHeadingBlock = z.object({
  ...BlockDocumentTextBlockBase,
  type: z.literal('heading'),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  text: z.string(),
});

export const BlockDocumentParagraphBlock = z.object({
  ...BlockDocumentTextBlockBase,
  type: z.literal('paragraph'),
  text: z.string(),
});

export const BlockDocumentRichTextBlock = z.object({
  ...BlockDocumentTextBlockBase,
  type: z.literal('richText'),
  markdown: z.string(),
});

export const BlockDocumentListBlock = z.object({
  ...BlockDocumentTextBlockBase,
  type: z.literal('list'),
  ordered: z.boolean().optional(),
  items: z.array(z.string()),
});

export const BlockDocumentTodoBlock = z.object({
  ...BlockDocumentTextBlockBase,
  type: z.literal('todo'),
  checked: z.boolean(),
  text: z.string(),
});

export const BlockDocumentImageBlock = z.object({
  ...BlockDocumentTextBlockBase,
  type: z.literal('image'),
  assetId: z.string(),
  caption: z.string().optional(),
});

export const BlockDocumentChartImageBlock = z.object({
  ...BlockDocumentTextBlockBase,
  type: z.literal('chartImage'),
  assetId: z.string(),
  caption: z.string().optional(),
});

export const BlockDocumentChartBlock = z.object({
  ...BlockDocumentTextBlockBase,
  type: z.literal('chart'),
  tableName: z.string(),
  config: z.unknown(),
  selectionGroupId: z.string().optional(),
  caption: z.string().optional(),
});

export const BlockDocumentStatefulBlockBlock = z.object({
  ...BlockDocumentTextBlockBase,
  type: z.literal('statefulBlock'),
  blockType: z.string(),
  blockInstanceId: z.string(),
  ownership: z.enum(['owned', 'shared', 'external']).optional(),
  title: z.string().optional(),
  caption: z.string().optional(),
});

export const BlockDocumentBlock = z.discriminatedUnion('type', [
  BlockDocumentHeadingBlock,
  BlockDocumentParagraphBlock,
  BlockDocumentRichTextBlock,
  BlockDocumentListBlock,
  BlockDocumentTodoBlock,
  BlockDocumentImageBlock,
  BlockDocumentChartImageBlock,
  BlockDocumentChartBlock,
  BlockDocumentStatefulBlockBlock,
]);
export type BlockDocumentBlock = z.infer<typeof BlockDocumentBlock>;

function textContent(text: string): TextContent | undefined {
  return text ? [{type: 'text', text}] : undefined;
}

function textFromNode(node: BlockDocumentNode | undefined): string {
  if (!node?.content) return node?.text ?? '';
  return node.content.map((child) => textFromNode(child)).join('');
}

function nodeId(node: BlockDocumentNode): string {
  const id = node.attrs?.id;
  return typeof id === 'string' ? id : '';
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function createEmptyBlockDocumentContent(): BlockDocumentContent {
  return {type: 'doc', content: []};
}

export function blockDocumentBlockToNode(
  block: BlockDocumentBlock,
): BlockDocumentNode {
  switch (block.type) {
    case 'heading':
      return {
        type: 'heading',
        attrs: {id: block.id, level: block.level},
        content: textContent(block.text),
      };
    case 'paragraph':
      return {
        type: 'paragraph',
        attrs: {id: block.id},
        content: textContent(block.text),
      };
    case 'richText':
      return {
        type: 'blockDocumentRichText',
        attrs: {id: block.id, markdown: block.markdown},
      };
    case 'list':
      return {
        type: block.ordered ? 'orderedList' : 'bulletList',
        attrs: {id: block.id},
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
        attrs: {id: block.id},
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
          id: block.id,
          assetId: block.assetId,
          ...(block.caption !== undefined ? {caption: block.caption} : {}),
        },
      };
    case 'chartImage':
      return {
        type: 'blockDocumentChartImage',
        attrs: {
          id: block.id,
          assetId: block.assetId,
          ...(block.caption !== undefined ? {caption: block.caption} : {}),
        },
      };
    case 'chart':
      return {
        type: 'blockDocumentChart',
        attrs: {
          id: block.id,
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
          id: block.id,
          blockType: block.blockType,
          blockInstanceId: block.blockInstanceId,
          ...(block.ownership !== undefined
            ? {ownership: block.ownership}
            : {}),
          ...(block.title !== undefined ? {title: block.title} : {}),
          ...(block.caption !== undefined ? {caption: block.caption} : {}),
        },
      };
  }
}

export function blockDocumentNodeToBlock(
  node: BlockDocumentNode,
): BlockDocumentBlock | undefined {
  const id = nodeId(node);
  if (!id) return undefined;

  switch (node.type) {
    case 'heading': {
      const level = node.attrs?.level;
      return BlockDocumentHeadingBlock.parse({
        id,
        type: 'heading',
        level: level === 1 || level === 2 || level === 3 ? level : 1,
        text: textFromNode(node),
      });
    }
    case 'paragraph':
      return {id, type: 'paragraph', text: textFromNode(node)};
    case 'blockDocumentRichText':
      return {
        id,
        type: 'richText',
        markdown:
          typeof node.attrs?.markdown === 'string' ? node.attrs.markdown : '',
      };
    case 'bulletList':
    case 'orderedList':
      return {
        id,
        type: 'list',
        ordered: node.type === 'orderedList' ? true : undefined,
        items:
          node.content?.map((item) => textFromNode(item.content?.[0])) ?? [],
      };
    case 'taskList': {
      const item = node.content?.[0];
      return {
        id,
        type: 'todo',
        checked: Boolean(item?.attrs?.checked),
        text: textFromNode(item?.content?.[0]),
      };
    }
    case 'blockDocumentImage':
      return BlockDocumentImageBlock.parse({
        id,
        type: 'image',
        assetId: node.attrs?.assetId,
        caption: optionalString(node.attrs?.caption),
      });
    case 'blockDocumentChartImage':
      return BlockDocumentChartImageBlock.parse({
        id,
        type: 'chartImage',
        assetId: node.attrs?.assetId,
        caption: optionalString(node.attrs?.caption),
      });
    case 'blockDocumentChart':
      return BlockDocumentChartBlock.parse({
        id,
        type: 'chart',
        tableName: node.attrs?.tableName,
        config: node.attrs?.config,
        selectionGroupId: optionalString(node.attrs?.selectionGroupId),
        caption: optionalString(node.attrs?.caption),
      });
    case 'blockDocumentStatefulBlock':
      return BlockDocumentStatefulBlockBlock.parse({
        id,
        type: 'statefulBlock',
        blockType: node.attrs?.blockType,
        blockInstanceId: node.attrs?.blockInstanceId,
        ownership: node.attrs?.ownership,
        title: optionalString(node.attrs?.title),
        caption: optionalString(node.attrs?.caption),
      });
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
