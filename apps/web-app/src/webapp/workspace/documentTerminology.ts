export const DOCUMENT_ARTIFACT_TYPE = 'document';
export const DEFAULT_DOCUMENT_TITLE = 'Document';

export function migrateLegacyWorksheetArtifacts(
  content: Record<string, unknown>,
) {
  const artifacts = content.artifacts;
  if (!artifacts || typeof artifacts !== 'object' || Array.isArray(artifacts)) {
    return content;
  }
  const artifactsById = (artifacts as Record<string, unknown>).artifactsById;
  if (
    !artifactsById ||
    typeof artifactsById !== 'object' ||
    Array.isArray(artifactsById)
  ) {
    return content;
  }

  return {
    ...content,
    artifacts: {
      ...(artifacts as Record<string, unknown>),
      artifactsById: Object.fromEntries(
        Object.entries(artifactsById).map(([artifactId, value]) => {
          if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return [artifactId, value];
          }
          const artifact = value as Record<string, unknown>;
          if (artifact.type !== 'worksheet') return [artifactId, artifact];
          return [
            artifactId,
            {
              ...artifact,
              type: DOCUMENT_ARTIFACT_TYPE,
              title:
                artifact.title === 'Worksheet'
                  ? DEFAULT_DOCUMENT_TITLE
                  : artifact.title,
            },
          ];
        }),
      ),
    },
  };
}
