import {
  defineArtifactTypes,
  type ArtifactTypeDefinition,
} from '@sqlrooms/artifacts';
import {CLI_ARTIFACT_TYPES, type CliArtifactType} from './artifactTypeIds';
import type {CliCapabilityProfile} from './profiles';
import type {RoomState} from './store-types';

const CLI_ARTIFACT_TITLES = {
  'block-document': 'Document',
  dashboard: 'Dashboard',
  pivot: 'Pivot',
  notebook: 'Notebook',
  markdown: 'Markdown',
  'sql-query': 'SQL Query',
  'html-app': 'HTML App',
  python: 'Python',
  canvas: 'Canvas',
  'app-builder': 'App Builder',
} as const satisfies Record<CliArtifactType, string>;

/** Production lifecycle definition shared by the browser and headless targets. */
export function createCliDocumentArtifactDefinition(): ArtifactTypeDefinition<RoomState> {
  return {
    label: 'Document',
    defaultTitle: 'Document',
    onCreate: ({artifactId, store}) => {
      store.getState().blockDocuments.ensureBlockDocument(artifactId);
    },
    onEnsure: ({artifactId, store}) => {
      store.getState().blockDocuments.ensureBlockDocument(artifactId);
    },
    onDelete: ({artifactId, store}) => {
      store.getState().blockDocuments.removeBlockDocument(artifactId);
    },
  };
}

/** Builds a UI-free artifact registry with the selected profile's capabilities. */
export function createCliHeadlessArtifactTypes(profile: CliCapabilityProfile) {
  const definitions = Object.fromEntries(
    CLI_ARTIFACT_TYPES.map((type) => [
      type,
      {
        ...(type === 'block-document'
          ? createCliDocumentArtifactDefinition()
          : {
              label: CLI_ARTIFACT_TITLES[type],
              defaultTitle: CLI_ARTIFACT_TITLES[type],
            }),
        canCreate: profile.artifacts.creatable.includes(type),
      } satisfies ArtifactTypeDefinition<RoomState>,
    ]),
  ) as Record<CliArtifactType, ArtifactTypeDefinition<RoomState>>;

  return defineArtifactTypes(definitions);
}
