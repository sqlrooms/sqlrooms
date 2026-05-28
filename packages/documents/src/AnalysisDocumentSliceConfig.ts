import {z} from 'zod';
import {DocumentAsset} from './DocumentsSliceConfig';

export type AnalysisDocumentMark = {
  type: string;
  attrs?: Record<string, unknown>;
  [key: string]: unknown;
};

export type AnalysisDocumentNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: AnalysisDocumentNode[];
  marks?: AnalysisDocumentMark[];
  text?: string;
  [key: string]: unknown;
};

export const AnalysisDocumentMark: z.ZodType<AnalysisDocumentMark> = z
  .object({
    type: z.string(),
    attrs: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export const AnalysisDocumentNode: z.ZodType<AnalysisDocumentNode> = z.lazy(
  () =>
    z
      .object({
        type: z.string(),
        attrs: z.record(z.string(), z.unknown()).optional(),
        content: z.array(AnalysisDocumentNode).optional(),
        marks: z.array(AnalysisDocumentMark).optional(),
        text: z.string().optional(),
      })
      .passthrough(),
);

export const AnalysisDocumentContent = z
  .object({
    type: z.literal('doc'),
    content: z.array(AnalysisDocumentNode).default([]),
  })
  .passthrough();
export type AnalysisDocumentContent = z.infer<typeof AnalysisDocumentContent>;

export const AnalysisDocument = z.object({
  id: z.string(),
  content: AnalysisDocumentContent.default({type: 'doc', content: []}),
  assets: z.record(z.string(), DocumentAsset).default({}),
  updatedAt: z.number().default(0),
});
export type AnalysisDocument = z.infer<typeof AnalysisDocument>;

export const AnalysisDocumentsSliceConfig = z.object({
  artifacts: z
    .record(z.string(), AnalysisDocument)
    .default({})
    .superRefine((artifacts, ctx) => {
      for (const [key, artifact] of Object.entries(artifacts)) {
        if (key !== artifact.id) {
          ctx.addIssue({
            code: 'custom',
            path: [key, 'id'],
            message: `Analysis artifact key "${key}" does not match artifact id "${artifact.id}"`,
          });
        }
      }
    }),
});
export type AnalysisDocumentsSliceConfig = z.infer<
  typeof AnalysisDocumentsSliceConfig
>;

type TextContent = Array<{
  type: 'text';
  text: string;
}>;

const AnalysisTextBlockBase = {
  id: z.string(),
};

export const AnalysisHeadingBlock = z.object({
  ...AnalysisTextBlockBase,
  type: z.literal('heading'),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  text: z.string(),
});

export const AnalysisParagraphBlock = z.object({
  ...AnalysisTextBlockBase,
  type: z.literal('paragraph'),
  text: z.string(),
});

export const AnalysisRichTextBlock = z.object({
  ...AnalysisTextBlockBase,
  type: z.literal('richText'),
  markdown: z.string(),
});

export const AnalysisListBlock = z.object({
  ...AnalysisTextBlockBase,
  type: z.literal('list'),
  ordered: z.boolean().optional(),
  items: z.array(z.string()),
});

export const AnalysisTodoBlock = z.object({
  ...AnalysisTextBlockBase,
  type: z.literal('todo'),
  checked: z.boolean(),
  text: z.string(),
});

export const AnalysisImageBlock = z.object({
  ...AnalysisTextBlockBase,
  type: z.literal('image'),
  assetId: z.string(),
  caption: z.string().optional(),
});

export const AnalysisChartImageBlock = z.object({
  ...AnalysisTextBlockBase,
  type: z.literal('chartImage'),
  assetId: z.string(),
  caption: z.string().optional(),
});

export const AnalysisChartBlock = z.object({
  ...AnalysisTextBlockBase,
  type: z.literal('chart'),
  tableName: z.string(),
  config: z.unknown(),
  selectionGroupId: z.string().optional(),
  caption: z.string().optional(),
});

export const AnalysisArtifactEmbedBlock = z.object({
  ...AnalysisTextBlockBase,
  type: z.literal('artifactEmbed'),
  artifactId: z.string(),
  artifactType: z.string(),
  caption: z.string().optional(),
});

export const AnalysisBlock = z.discriminatedUnion('type', [
  AnalysisHeadingBlock,
  AnalysisParagraphBlock,
  AnalysisRichTextBlock,
  AnalysisListBlock,
  AnalysisTodoBlock,
  AnalysisImageBlock,
  AnalysisChartImageBlock,
  AnalysisChartBlock,
  AnalysisArtifactEmbedBlock,
]);
export type AnalysisBlock = z.infer<typeof AnalysisBlock>;

function textContent(text: string): TextContent | undefined {
  return text ? [{type: 'text', text}] : undefined;
}

function textFromNode(node: AnalysisDocumentNode | undefined): string {
  if (!node?.content) return node?.text ?? '';
  return node.content.map((child) => textFromNode(child)).join('');
}

function nodeId(node: AnalysisDocumentNode): string {
  const id = node.attrs?.id;
  return typeof id === 'string' ? id : '';
}

export function createEmptyAnalysisDocumentContent(): AnalysisDocumentContent {
  return {type: 'doc', content: []};
}

export function analysisBlockToNode(
  block: AnalysisBlock,
): AnalysisDocumentNode {
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
        type: 'analysisRichText',
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
        type: 'analysisImage',
        attrs: {
          id: block.id,
          assetId: block.assetId,
          caption: block.caption,
        },
      };
    case 'chartImage':
      return {
        type: 'analysisChartImage',
        attrs: {
          id: block.id,
          assetId: block.assetId,
          caption: block.caption,
        },
      };
    case 'chart':
      return {
        type: 'analysisChart',
        attrs: {
          id: block.id,
          tableName: block.tableName,
          config: block.config,
          selectionGroupId: block.selectionGroupId,
          caption: block.caption,
        },
      };
    case 'artifactEmbed':
      return {
        type: 'analysisArtifactEmbed',
        attrs: {
          id: block.id,
          artifactId: block.artifactId,
          artifactType: block.artifactType,
          caption: block.caption,
        },
      };
  }
}

export function analysisNodeToBlock(
  node: AnalysisDocumentNode,
): AnalysisBlock | undefined {
  const id = nodeId(node);
  if (!id) return undefined;

  switch (node.type) {
    case 'heading': {
      const level = node.attrs?.level;
      return AnalysisHeadingBlock.parse({
        id,
        type: 'heading',
        level: level === 1 || level === 2 || level === 3 ? level : 1,
        text: textFromNode(node),
      });
    }
    case 'paragraph':
      return {id, type: 'paragraph', text: textFromNode(node)};
    case 'analysisRichText':
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
    case 'analysisImage':
      return AnalysisImageBlock.parse({
        id,
        type: 'image',
        assetId: node.attrs?.assetId,
        caption: node.attrs?.caption,
      });
    case 'analysisChartImage':
      return AnalysisChartImageBlock.parse({
        id,
        type: 'chartImage',
        assetId: node.attrs?.assetId,
        caption: node.attrs?.caption,
      });
    case 'analysisChart':
      return AnalysisChartBlock.parse({
        id,
        type: 'chart',
        tableName: node.attrs?.tableName,
        config: node.attrs?.config,
        selectionGroupId: node.attrs?.selectionGroupId,
        caption: node.attrs?.caption,
      });
    case 'analysisArtifactEmbed':
      return AnalysisArtifactEmbedBlock.parse({
        id,
        type: 'artifactEmbed',
        artifactId: node.attrs?.artifactId,
        artifactType: node.attrs?.artifactType,
        caption: node.attrs?.caption,
      });
    default:
      return undefined;
  }
}

export function analysisContentToBlocks(
  content: AnalysisDocumentContent,
): AnalysisBlock[] {
  return content.content
    .map((node) => analysisNodeToBlock(node))
    .filter((block): block is AnalysisBlock => Boolean(block));
}
