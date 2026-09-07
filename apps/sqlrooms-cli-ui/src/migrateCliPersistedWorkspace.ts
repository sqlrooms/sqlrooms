import {z} from 'zod';

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;
}

function hasArtifact(
  slice: UnknownRecord | undefined,
  artifactId: string,
): boolean {
  const artifacts = asRecord(slice?.artifacts);
  return artifacts
    ? Object.prototype.hasOwnProperty.call(artifacts, artifactId)
    : false;
}

function migrateEmbeddedMarkdownBlockTypes(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(migrateEmbeddedMarkdownBlockTypes);
  }

  const record = asRecord(value);
  if (!record) return value;

  const attrs = asRecord(record.attrs);
  return Object.fromEntries(
    Object.entries(record).map(([key, child]) => {
      if (key === 'attrs' && attrs?.blockType === 'document') {
        return [key, {...attrs, blockType: 'markdown'}];
      }
      return [key, migrateEmbeddedMarkdownBlockTypes(child)];
    }),
  );
}

function migrateBlockDocumentsSlice(value: unknown): unknown {
  const slice = asRecord(value);
  const artifacts = asRecord(slice?.artifacts);
  if (!slice || !artifacts) return value;

  return {
    ...slice,
    artifacts: Object.fromEntries(
      Object.entries(artifacts).map(([artifactId, artifactValue]) => {
        const artifact = asRecord(artifactValue);
        if (!artifact || !('content' in artifact)) {
          return [artifactId, artifactValue];
        }
        return [
          artifactId,
          {
            ...artifact,
            content: migrateEmbeddedMarkdownBlockTypes(artifact.content),
          },
        ];
      }),
    ),
  };
}

function preprocessCliPersistedWorkspace(value: unknown): unknown {
  const workspace = asRecord(value);
  if (!workspace) return value;

  const artifactsSlice = asRecord(workspace.artifacts);
  const artifactsById = asRecord(artifactsSlice?.artifactsById);
  const documentsSlice = asRecord(workspace.documents);
  const blockDocumentsSlice = asRecord(workspace.blockDocuments);
  if (!artifactsSlice || !artifactsById) {
    return {
      ...workspace,
      blockDocuments: migrateBlockDocumentsSlice(workspace.blockDocuments),
    };
  }

  const migratedArtifactsById = Object.fromEntries(
    Object.entries(artifactsById).map(([artifactId, artifactValue]) => {
      const artifact = asRecord(artifactValue);
      if (!artifact || typeof artifact.type !== 'string') {
        return [artifactId, artifactValue];
      }

      let type = artifact.type;
      if (type === 'worksheet') {
        type = 'block-document';
      } else if (type === 'document') {
        const hasBlockDocument = hasArtifact(blockDocumentsSlice, artifactId);
        const hasMarkdownDocument = hasArtifact(documentsSlice, artifactId);
        if (hasBlockDocument) {
          type = 'block-document';
        } else if (hasMarkdownDocument) {
          type = 'markdown';
        } else {
          // Before this migration, "document" only meant the Markdown
          // artifact. Preserve that meaning for incomplete legacy snapshots.
          type = 'markdown';
        }
      }

      return [
        artifactId,
        type === artifact.type ? artifact : {...artifact, type},
      ];
    }),
  );

  return {
    ...workspace,
    artifacts: {...artifactsSlice, artifactsById: migratedArtifactsById},
    blockDocuments: migrateBlockDocumentsSlice(workspace.blockDocuments),
  };
}

const CliPersistedWorkspaceRecord = z
  .record(z.string(), z.unknown())
  .superRefine((workspace, ctx) => {
    const documentsSlice = asRecord(workspace.documents);
    const blockDocumentsSlice = asRecord(workspace.blockDocuments);
    const markdownArtifacts = asRecord(documentsSlice?.artifacts);
    const blockDocumentArtifacts = asRecord(blockDocumentsSlice?.artifacts);
    if (!markdownArtifacts || !blockDocumentArtifacts) return;

    for (const artifactId of Object.keys(markdownArtifacts)) {
      if (
        Object.prototype.hasOwnProperty.call(blockDocumentArtifacts, artifactId)
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['artifacts', 'artifactsById', artifactId, 'type'],
          message: `Artifact "${artifactId}" cannot have both Markdown and block-document backing state.`,
        });
      }
    }
  });

/**
 * Migrates legacy CLI artifact discriminators with access to their backing
 * slices, then validates that each artifact has at most one document backing
 * state.
 */
export const CliPersistedWorkspaceSchema = z.preprocess(
  preprocessCliPersistedWorkspace,
  CliPersistedWorkspaceRecord,
);

/** Parses and migrates one aggregate persisted CLI workspace snapshot. */
export function migrateCliPersistedWorkspace(value: unknown): UnknownRecord {
  return CliPersistedWorkspaceSchema.parse(value);
}
