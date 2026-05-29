import {z} from 'zod';
import {DocumentAsset} from './DocumentsSliceConfig';

export type BlocksDocumentMark = {
  type: string;
  attrs?: Record<string, unknown>;
  [key: string]: unknown;
};

export type BlocksDocumentNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: BlocksDocumentNode[];
  marks?: BlocksDocumentMark[];
  text?: string;
  [key: string]: unknown;
};

export const BlocksDocumentMark: z.ZodType<BlocksDocumentMark> = z
  .object({
    type: z.string(),
    attrs: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export const BlocksDocumentNode: z.ZodType<BlocksDocumentNode> = z.lazy(
  () =>
    z
      .object({
        type: z.string(),
        attrs: z.record(z.string(), z.unknown()).optional(),
        content: z.array(BlocksDocumentNode).optional(),
        marks: z.array(BlocksDocumentMark).optional(),
        text: z.string().optional(),
      })
      .passthrough(),
);

export const BlocksDocumentContent = z
  .object({
    type: z.literal('doc'),
    content: z.array(BlocksDocumentNode).default([]),
  })
  .passthrough();
export type BlocksDocumentContent = z.infer<typeof BlocksDocumentContent>;

export const BlocksDocument = z.object({
  id: z.string(),
  content: BlocksDocumentContent.default({type: 'doc', content: []}),
  assets: z.record(z.string(), DocumentAsset).default({}),
  updatedAt: z.number().default(0),
});
export type BlocksDocument = z.infer<typeof BlocksDocument>;

export const BlocksDocumentsSliceConfig = z.object({
  artifacts: z
    .record(z.string(), BlocksDocument)
    .default({})
    .superRefine((artifacts, ctx) => {
      for (const [key, artifact] of Object.entries(artifacts)) {
        if (key !== artifact.id) {
          ctx.addIssue({
            code: 'custom',
            path: [key, 'id'],
            message: `Blocks document key "${key}" does not match document id "${artifact.id}"`,
          });
        }
      }
    }),
});
export type BlocksDocumentsSliceConfig = z.infer<
  typeof BlocksDocumentsSliceConfig
>;

type TextContent = Array<{
  type: 'text';
  text: string;
}>;

const BlocksDocumentTextBlockBase = {
  id: z.string(),
};

export const BlocksDocumentHeadingBlock = z.object({
  ...BlocksDocumentTextBlockBase,
  type: z.literal('heading'),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  text: z.string(),
});

export const BlocksDocumentParagraphBlock = z.object({
  ...BlocksDocumentTextBlockBase,
  type: z.literal('paragraph'),
  text: z.string(),
});

export const BlocksDocumentRichTextBlock = z.object({
  ...BlocksDocumentTextBlockBase,
  type: z.literal('richText'),
  markdown: z.string(),
});

export const BlocksDocumentListBlock = z.object({
  ...BlocksDocumentTextBlockBase,
  type: z.literal('list'),
  ordered: z.boolean().optional(),
  items: z.array(z.string()),
});

export const BlocksDocumentTodoBlock = z.object({
  ...BlocksDocumentTextBlockBase,
  type: z.literal('todo'),
  checked: z.boolean(),
  text: z.string(),
});

export const BlocksDocumentImageBlock = z.object({
  ...BlocksDocumentTextBlockBase,
  type: z.literal('image'),
  assetId: z.string(),
  caption: z.string().optional(),
});

export const BlocksDocumentChartImageBlock = z.object({
  ...BlocksDocumentTextBlockBase,
  type: z.literal('chartImage'),
  assetId: z.string(),
  caption: z.string().optional(),
});

export const BlocksDocumentChartBlock = z.object({
  ...BlocksDocumentTextBlockBase,
  type: z.literal('chart'),
  tableName: z.string(),
  config: z.unknown(),
  selectionGroupId: z.string().optional(),
  caption: z.string().optional(),
});

export const BlocksDocumentArtifactEmbedBlock = z.object({
  ...BlocksDocumentTextBlockBase,
  type: z.literal('artifactEmbed'),
  artifactId: z.string(),
  artifactType: z.string(),
  caption: z.string().optional(),
});

export const BlocksDocumentBlock = z.discriminatedUnion('type', [
  BlocksDocumentHeadingBlock,
  BlocksDocumentParagraphBlock,
  BlocksDocumentRichTextBlock,
  BlocksDocumentListBlock,
  BlocksDocumentTodoBlock,
  BlocksDocumentImageBlock,
  BlocksDocumentChartImageBlock,
  BlocksDocumentChartBlock,
  BlocksDocumentArtifactEmbedBlock,
]);
export type BlocksDocumentBlock = z.infer<typeof BlocksDocumentBlock>;

function textContent(text: string): TextContent | undefined {
  return text ? [{type: 'text', text}] : undefined;
}

function textFromNode(node: BlocksDocumentNode | undefined): string {
  if (!node?.content) return node?.text ?? '';
  return node.content.map((child) => textFromNode(child)).join('');
}

function nodeId(node: BlocksDocumentNode): string {
  const id = node.attrs?.id;
  return typeof id === 'string' ? id : '';
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function createEmptyBlocksDocumentContent(): BlocksDocumentContent {
  return {type: 'doc', content: []};
}

export function blocksDocumentBlockToNode(
  block: BlocksDocumentBlock,
): BlocksDocumentNode {
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
        type: 'blocksDocumentRichText',
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
        type: 'blocksDocumentImage',
        attrs: {
          id: block.id,
          assetId: block.assetId,
          ...(block.caption !== undefined ? {caption: block.caption} : {}),
        },
      };
    case 'chartImage':
      return {
        type: 'blocksDocumentChartImage',
        attrs: {
          id: block.id,
          assetId: block.assetId,
          ...(block.caption !== undefined ? {caption: block.caption} : {}),
        },
      };
    case 'chart':
      return {
        type: 'blocksDocumentChart',
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
    case 'artifactEmbed':
      return {
        type: 'blocksDocumentArtifactEmbed',
        attrs: {
          id: block.id,
          artifactId: block.artifactId,
          artifactType: block.artifactType,
          ...(block.caption !== undefined ? {caption: block.caption} : {}),
        },
      };
  }
}

export function blocksDocumentNodeToBlock(
  node: BlocksDocumentNode,
): BlocksDocumentBlock | undefined {
  const id = nodeId(node);
  if (!id) return undefined;

  switch (node.type) {
    case 'heading': {
      const level = node.attrs?.level;
      return BlocksDocumentHeadingBlock.parse({
        id,
        type: 'heading',
        level: level === 1 || level === 2 || level === 3 ? level : 1,
        text: textFromNode(node),
      });
    }
    case 'paragraph':
      return {id, type: 'paragraph', text: textFromNode(node)};
    case 'blocksDocumentRichText':
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
    case 'blocksDocumentImage':
      return BlocksDocumentImageBlock.parse({
        id,
        type: 'image',
        assetId: node.attrs?.assetId,
        caption: optionalString(node.attrs?.caption),
      });
    case 'blocksDocumentChartImage':
      return BlocksDocumentChartImageBlock.parse({
        id,
        type: 'chartImage',
        assetId: node.attrs?.assetId,
        caption: optionalString(node.attrs?.caption),
      });
    case 'blocksDocumentChart':
      return BlocksDocumentChartBlock.parse({
        id,
        type: 'chart',
        tableName: node.attrs?.tableName,
        config: node.attrs?.config,
        selectionGroupId: optionalString(node.attrs?.selectionGroupId),
        caption: optionalString(node.attrs?.caption),
      });
    case 'blocksDocumentArtifactEmbed':
      return BlocksDocumentArtifactEmbedBlock.parse({
        id,
        type: 'artifactEmbed',
        artifactId: node.attrs?.artifactId,
        artifactType: node.attrs?.artifactType,
        caption: optionalString(node.attrs?.caption),
      });
    default:
      return undefined;
  }
}

export function blocksDocumentContentToBlocks(
  content: BlocksDocumentContent,
): BlocksDocumentBlock[] {
  return content.content
    .map((node) => blocksDocumentNodeToBlock(node))
    .filter((block): block is BlocksDocumentBlock => Boolean(block));
}
