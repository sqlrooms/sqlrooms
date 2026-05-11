import type {ArtifactMetadataType} from '@sqlrooms/artifacts';
import type {BaseRoomStoreState, RoomCommand} from '@sqlrooms/room-store';
import {z} from 'zod';
import type {DocumentsSliceState} from './DocumentsSlice';

export const DOCUMENT_AI_INSTRUCTIONS = `
Document artifacts:
- Use list_commands to discover document commands, then execute_command to run them.
- Use document.list and document.get to inspect Markdown document artifacts.
- Use document.create to create a new Markdown document artifact.
- Use document.set-markdown only when replacing the full document body is intended.
- Use document.append-markdown for additive edits that should keep existing content.
`.trim();

type DocumentCommandState = BaseRoomStoreState & {
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
} & DocumentsSliceState;

const DocumentIdInput = z
  .object({
    artifactId: z.string().optional().describe('Target document artifact ID.'),
  })
  .default({});

const DocumentCreateInput = z
  .object({
    title: z.string().optional().describe('Optional document title.'),
    markdown: z.string().optional().describe('Initial Markdown content.'),
    select: z
      .boolean()
      .optional()
      .describe('Whether to select the new document artifact.'),
  })
  .default({});

const DocumentSetMarkdownInput = z.object({
  artifactId: z.string().describe('Target document artifact ID.'),
  markdown: z.string().describe('Replacement Markdown content.'),
});

const DocumentAppendMarkdownInput = z.object({
  artifactId: z.string().describe('Target document artifact ID.'),
  markdown: z.string().describe('Markdown content to append.'),
});

export function createDocumentCommands<
  TRoomState extends DocumentCommandState = DocumentCommandState,
>(): RoomCommand<TRoomState>[] {
  return [
    {
      id: 'document.list',
      name: 'List documents',
      description: 'List Markdown document artifacts in the room',
      group: 'Documents',
      keywords: ['document', 'markdown', 'list', 'read'],
      metadata: {
        readOnly: true,
        idempotent: true,
        riskLevel: 'low',
      },
      execute: ({getState}) => {
        const state = getState();
        const documents = Object.values(state.artifacts.config.artifactsById)
          .filter((artifact) => artifact.type === 'document')
          .map((artifact) => {
            const document = state.documents.getDocument(artifact.id);
            return {
              artifactId: artifact.id,
              title: artifact.title,
              updatedAt: document?.updatedAt,
              markdownLength: document?.markdown.length ?? 0,
            };
          });

        return {
          success: true,
          commandId: 'document.list',
          data: {documents},
        };
      },
    },
    {
      id: 'document.get',
      name: 'Get document',
      description:
        'Read Markdown from a document artifact. Defaults to the current document artifact.',
      group: 'Documents',
      keywords: ['document', 'markdown', 'read', 'get'],
      inputSchema: DocumentIdInput,
      inputDescription:
        'Optional document artifact ID. Defaults to the current document.',
      metadata: {
        readOnly: true,
        idempotent: true,
        riskLevel: 'low',
      },
      execute: ({getState}, input) => {
        const state = getState();
        const {artifactId: requestedArtifactId} =
          (input as z.infer<typeof DocumentIdInput> | undefined) ?? {};
        const artifactId =
          requestedArtifactId ?? state.artifacts.config.currentArtifactId;
        const resolved = resolveDocumentArtifact(
          state,
          artifactId,
          'document.get',
        );
        if (!resolved.success) return resolved;

        const document = state.documents.getDocument(resolved.artifact.id);
        return {
          success: true,
          commandId: 'document.get',
          data: {
            artifactId: resolved.artifact.id,
            title: resolved.artifact.title,
            markdown: document?.markdown ?? '',
            updatedAt: document?.updatedAt,
          },
        };
      },
    },
    {
      id: 'document.create',
      name: 'Create document',
      description:
        'Create a Markdown document artifact, optionally with initial Markdown content',
      group: 'Documents',
      keywords: ['document', 'markdown', 'create', 'new'],
      inputSchema: DocumentCreateInput,
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
        } = (input as z.infer<typeof DocumentCreateInput> | undefined) ?? {};
        const state = getState();
        const previousArtifactId = state.artifacts.config.currentArtifactId;
        const artifactId = state.artifacts.createArtifact({
          type: 'document',
          title: title ?? 'Document',
        });
        state.documents.ensureDocument(artifactId);
        if (markdown) {
          state.documents.setMarkdown(artifactId, markdown);
        }
        if (select) {
          state.artifacts.setCurrentArtifact(artifactId);
        } else {
          state.artifacts.setCurrentArtifact(previousArtifactId);
        }

        return {
          success: true,
          commandId: 'document.create',
          message: `Created document artifact "${artifactId}".`,
          data: {
            artifactId,
            title: state.artifacts.getArtifact(artifactId)?.title,
            markdown: state.documents.getDocument(artifactId)?.markdown ?? '',
          },
        };
      },
    },
    {
      id: 'document.set-markdown',
      name: 'Set document markdown',
      description: 'Replace the Markdown content for a document artifact',
      group: 'Documents',
      keywords: ['document', 'markdown', 'replace', 'set', 'edit'],
      inputSchema: DocumentSetMarkdownInput,
      inputDescription: 'Document artifact ID and replacement Markdown.',
      metadata: {
        readOnly: false,
        idempotent: false,
        riskLevel: 'medium',
      },
      execute: ({getState}, input) => {
        const state = getState();
        const {artifactId, markdown} = input as z.infer<
          typeof DocumentSetMarkdownInput
        >;
        const resolved = resolveDocumentArtifact(
          state,
          artifactId,
          'document.set-markdown',
        );
        if (!resolved.success) return resolved;

        state.documents.setMarkdown(artifactId, markdown);
        return {
          success: true,
          commandId: 'document.set-markdown',
          message: `Updated document artifact "${artifactId}".`,
          data: {
            artifactId,
            markdown,
            updatedAt: state.documents.getDocument(artifactId)?.updatedAt,
          },
        };
      },
    },
    {
      id: 'document.append-markdown',
      name: 'Append document markdown',
      description: 'Append Markdown content to a document artifact',
      group: 'Documents',
      keywords: ['document', 'markdown', 'append', 'edit'],
      inputSchema: DocumentAppendMarkdownInput,
      inputDescription: 'Document artifact ID and Markdown to append.',
      metadata: {
        readOnly: false,
        idempotent: false,
        riskLevel: 'medium',
      },
      execute: ({getState}, input) => {
        const state = getState();
        const {artifactId, markdown} = input as z.infer<
          typeof DocumentAppendMarkdownInput
        >;
        const resolved = resolveDocumentArtifact(
          state,
          artifactId,
          'document.append-markdown',
        );
        if (!resolved.success) return resolved;

        state.documents.ensureDocument(artifactId);
        const existing =
          state.documents.getDocument(artifactId)?.markdown ?? '';
        const nextMarkdown = appendMarkdown(existing, markdown);
        state.documents.setMarkdown(artifactId, nextMarkdown);
        return {
          success: true,
          commandId: 'document.append-markdown',
          message: `Appended Markdown to document artifact "${artifactId}".`,
          data: {
            artifactId,
            markdown: nextMarkdown,
            updatedAt: state.documents.getDocument(artifactId)?.updatedAt,
          },
        };
      },
    },
  ];
}

function resolveDocumentArtifact(
  state: DocumentCommandState,
  artifactId: string | undefined,
  commandId: string,
) {
  if (!artifactId) {
    return {
      success: false as const,
      commandId,
      error: 'No document artifact is selected. Provide artifactId.',
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
  if (artifact.type !== 'document') {
    return {
      success: false as const,
      commandId,
      error: `Artifact "${artifactId}" is not a document artifact.`,
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
