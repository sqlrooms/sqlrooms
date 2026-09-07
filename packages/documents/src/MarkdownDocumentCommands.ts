import {
  resolveArtifactTargetId,
  type ArtifactMetadataType,
} from '@sqlrooms/artifacts';
import type {BaseRoomStoreState, RoomCommand} from '@sqlrooms/room-store';
import {z} from 'zod';
import type {MarkdownDocumentsSliceState} from './MarkdownDocumentsSlice';

type MarkdownDocumentCommandState = BaseRoomStoreState & {
  artifacts: {
    createArtifact: (artifact: {
      type: string;
      id?: string;
      title?: string;
    }) => string;
    setCurrentArtifact: (id?: string) => void;
    getArtifact: (id: string) => ArtifactMetadataType | undefined;
    config: {
      artifactsById: Record<string, ArtifactMetadataType>;
      currentArtifactId?: string;
    };
  };
} & MarkdownDocumentsSliceState;

const MarkdownIdInput = z
  .object({
    artifactId: z
      .string()
      .optional()
      .describe('Target Markdown document artifact ID.'),
  })
  .default({});

const MarkdownCreateInput = z
  .object({
    title: z
      .string()
      .optional()
      .describe('Optional Markdown document artifact title.'),
    markdown: z.string().optional().describe('Initial Markdown content.'),
    select: z
      .boolean()
      .optional()
      .describe('Whether to select the new Markdown document artifact.'),
  })
  .default({});

const MarkdownSetInput = z.object({
  artifactId: z.string().describe('Target Markdown document artifact ID.'),
  markdown: z.string().describe('Replacement Markdown content.'),
});

const MarkdownAppendInput = z.object({
  artifactId: z.string().describe('Target Markdown document artifact ID.'),
  markdown: z.string().describe('Markdown content to append.'),
});

/** Creates the room command family for Markdown document artifacts. */
export function createMarkdownDocumentCommands<
  TRoomState extends MarkdownDocumentCommandState =
    MarkdownDocumentCommandState,
>(): RoomCommand<TRoomState>[] {
  return [
    {
      id: 'markdown-document.list',
      name: 'List Markdown document artifacts',
      description: 'List Markdown document artifacts in the room',
      group: 'Markdown',
      keywords: ['markdown', 'list', 'read'],
      metadata: {
        readOnly: true,
        idempotent: true,
        riskLevel: 'low',
      },
      execute: ({getState}) => {
        const state = getState();
        const markdownArtifacts = Object.values(
          state.artifacts.config.artifactsById,
        )
          .filter((artifact) => artifact.type === 'markdown-document')
          .map((artifact) => {
            const document = state.markdownDocuments.getDocument(artifact.id);
            return {
              artifactId: artifact.id,
              title: artifact.title,
              updatedAt: document?.updatedAt,
              markdownLength: document?.markdown.length ?? 0,
              assetCount: Object.keys(document?.assets ?? {}).length,
            };
          });

        return {
          success: true,
          commandId: 'markdown-document.list',
          data: {markdownArtifacts},
        };
      },
    },
    {
      id: 'markdown-document.get',
      name: 'Get Markdown',
      description:
        'Read content from a Markdown document artifact. Defaults to the current Markdown document artifact.',
      group: 'Markdown',
      keywords: ['markdown', 'read', 'get'],
      inputSchema: MarkdownIdInput,
      inputDescription:
        'Optional Markdown document artifact ID. Defaults to the current Markdown document artifact.',
      metadata: {
        readOnly: true,
        idempotent: true,
        riskLevel: 'low',
      },
      execute: ({getState, invocation}, input) => {
        const state = getState();
        const {artifactId: requestedArtifactId} =
          (input as z.infer<typeof MarkdownIdInput> | undefined) ?? {};
        const artifactId = resolveArtifactTargetId({
          requestedArtifactId,
          invocation,
          currentArtifactId: state.artifacts.config.currentArtifactId,
        });
        const resolved = resolveMarkdownArtifact(
          state,
          artifactId,
          'markdown-document.get',
        );
        if (!resolved.success) return resolved;

        const document = state.markdownDocuments.getDocument(
          resolved.artifact.id,
        );
        return {
          success: true,
          commandId: 'markdown-document.get',
          data: {
            artifactId: resolved.artifact.id,
            title: resolved.artifact.title,
            markdown: document?.markdown ?? '',
            assets: Object.values(document?.assets ?? {}).map(
              markdownAssetMetadata,
            ),
            updatedAt: document?.updatedAt,
          },
        };
      },
    },
    {
      id: 'markdown-document.create',
      name: 'Create Markdown',
      description:
        'Create a Markdown document artifact with optional initial content',
      group: 'Markdown',
      keywords: ['markdown', 'create', 'new'],
      inputSchema: MarkdownCreateInput,
      inputDescription: 'Optional title, initial markdown, and select flag.',
      metadata: {
        readOnly: false,
        idempotent: false,
        riskLevel: 'low',
      },
      execute: ({getState}, input) => {
        const {
          title,
          markdown = '',
          select = true,
        } = (input as z.infer<typeof MarkdownCreateInput> | undefined) ?? {};
        const state = getState();
        const previousArtifactId = state.artifacts.config.currentArtifactId;
        const artifactId = state.artifacts.createArtifact({
          type: 'markdown-document',
          title: title ?? 'Markdown',
        });
        state.markdownDocuments.ensureDocument(artifactId);
        if (markdown) {
          state.markdownDocuments.setMarkdown(artifactId, markdown);
        }
        if (select) {
          state.artifacts.setCurrentArtifact(artifactId);
        } else {
          state.artifacts.setCurrentArtifact(previousArtifactId);
        }

        return {
          success: true,
          commandId: 'markdown-document.create',
          message: `Created Markdown document artifact "${artifactId}".`,
          data: {
            artifactId,
            title: state.artifacts.getArtifact(artifactId)?.title,
            markdown:
              state.markdownDocuments.getDocument(artifactId)?.markdown ?? '',
            assets: Object.values(
              state.markdownDocuments.getDocument(artifactId)?.assets ?? {},
            ).map(markdownAssetMetadata),
          },
        };
      },
    },
    {
      id: 'markdown-document.set-markdown',
      name: 'Set Markdown',
      description: 'Replace the content of a Markdown document artifact',
      group: 'Markdown',
      keywords: ['markdown', 'replace', 'set', 'edit'],
      inputSchema: MarkdownSetInput,
      inputDescription:
        'Markdown document artifact ID and replacement content.',
      metadata: {
        readOnly: false,
        idempotent: false,
        riskLevel: 'medium',
      },
      execute: ({getState}, input) => {
        const state = getState();
        const {artifactId, markdown} = input as z.infer<
          typeof MarkdownSetInput
        >;
        const resolved = resolveMarkdownArtifact(
          state,
          artifactId,
          'markdown-document.set-markdown',
        );
        if (!resolved.success) return resolved;

        state.markdownDocuments.setMarkdown(artifactId, markdown);
        return {
          success: true,
          commandId: 'markdown-document.set-markdown',
          message: `Updated Markdown document artifact "${artifactId}".`,
          data: {
            artifactId,
            markdown,
            updatedAt:
              state.markdownDocuments.getDocument(artifactId)?.updatedAt,
          },
        };
      },
    },
    {
      id: 'markdown-document.append-markdown',
      name: 'Append Markdown',
      description: 'Append content to a Markdown document artifact',
      group: 'Markdown',
      keywords: ['markdown', 'append', 'edit'],
      inputSchema: MarkdownAppendInput,
      inputDescription: 'Markdown document artifact ID and content to append.',
      metadata: {
        readOnly: false,
        idempotent: false,
        riskLevel: 'medium',
      },
      execute: ({getState}, input) => {
        const state = getState();
        const {artifactId, markdown} = input as z.infer<
          typeof MarkdownAppendInput
        >;
        const resolved = resolveMarkdownArtifact(
          state,
          artifactId,
          'markdown-document.append-markdown',
        );
        if (!resolved.success) return resolved;

        state.markdownDocuments.ensureDocument(artifactId);
        const existing =
          state.markdownDocuments.getDocument(artifactId)?.markdown ?? '';
        const nextMarkdown = appendMarkdown(existing, markdown);
        state.markdownDocuments.setMarkdown(artifactId, nextMarkdown);
        return {
          success: true,
          commandId: 'markdown-document.append-markdown',
          message: `Appended content to Markdown document artifact "${artifactId}".`,
          data: {
            artifactId,
            markdown: nextMarkdown,
            updatedAt:
              state.markdownDocuments.getDocument(artifactId)?.updatedAt,
          },
        };
      },
    },
  ];
}

function resolveMarkdownArtifact(
  state: MarkdownDocumentCommandState,
  artifactId: string | undefined,
  commandId: string,
) {
  if (!artifactId) {
    return {
      success: false as const,
      commandId,
      error: 'No Markdown document artifact is selected. Provide artifactId.',
    };
  }
  const artifact = state.artifacts.getArtifact(artifactId);
  if (!artifact) {
    return {
      success: false as const,
      commandId,
      error: `Unknown artifact "${artifactId}".`,
    };
  }
  if (artifact.type !== 'markdown-document') {
    return {
      success: false as const,
      commandId,
      error: `Artifact "${artifactId}" is not a Markdown document artifact.`,
    };
  }
  return {success: true as const, artifact};
}

function appendMarkdown(existing: string, markdown: string) {
  const trimmedAppend = markdown.trim();
  if (!trimmedAppend) return existing;
  const trimmedExisting = existing.trimEnd();
  if (!trimmedExisting) return trimmedAppend;
  return `${trimmedExisting}\n\n${trimmedAppend}`;
}

function markdownAssetMetadata(
  asset: MarkdownDocumentCommandState['markdownDocuments']['config']['artifacts'][string]['assets'][string],
) {
  return {
    id: asset.id,
    mediaType: asset.mediaType,
    encoding: asset.encoding,
    filename: asset.filename,
    alt: asset.alt,
    title: asset.title,
    provenance: asset.provenance,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
  };
}
