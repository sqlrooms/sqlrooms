import {
  ArtifactsSliceConfig,
  type ArtifactsSliceState,
  type ArtifactsSliceConfig as ArtifactsSliceConfigType,
} from '@sqlrooms/artifacts';
import {
  ArtifactAiConfig,
  type ArtifactAiConfig as ArtifactAiConfigType,
  type ArtifactAiSliceState,
} from '@sqlrooms/artifacts/ai';
import {
  BlockDocumentsSliceConfig,
  type BlockDocumentContent,
  type BlockDocumentsSliceState,
  type BlockDocumentsSliceConfig as BlockDocumentsSliceConfigType,
} from '@sqlrooms/documents';
import {
  MosaicDashboardSliceConfig,
  type MosaicDashboardSliceState,
  type MosaicDashboardSliceConfig as MosaicDashboardSliceConfigType,
} from '@sqlrooms/mosaic';
import type {SqlEditorSliceState} from '@sqlrooms/sql-editor';
import {SqlEditorSliceConfig} from '@sqlrooms/sql-editor-config';
import type {JsonObject} from '#/lib/json';
import {createDefaultDocumentContent} from '../document/defaultBlockDocument';
import {
  createEmptyPersistedSqlEditorConfig,
  ensureStatefulBlocksForContent,
} from '../document/documentState';
import {
  DEFAULT_DOCUMENT_TITLE,
  DOCUMENT_ARTIFACT_TYPE,
} from './documentTerminology';

export type WorkspaceDocument = {
  id: string;
  title: string;
  content: JsonObject;
};

export type WorkspaceContent = {
  artifacts: ArtifactsSliceConfigType;
  blockDocuments: BlockDocumentsSliceConfigType;
  sqlEditor: SqlEditorSliceConfig;
  mosaicDashboard: MosaicDashboardSliceConfigType;
  artifactAi: ArtifactAiConfigType;
};

export type WorkspaceContentRoomState = ArtifactsSliceState &
  BlockDocumentsSliceState &
  SqlEditorSliceState &
  MosaicDashboardSliceState &
  ArtifactAiSliceState;

const DEFAULT_DOCUMENT_ID = 'default-document';

export function hydrateWorkspaceContent({
  content,
  currentDocumentId,
  store,
}: {
  content: JsonObject | undefined;
  currentDocumentId?: string;
  store: {getState: () => WorkspaceContentRoomState};
}) {
  const parsedContent =
    parseWorkspaceContent(content) ?? createDefaultWorkspaceContent();
  const state = store.getState();

  state.artifactAi.setConfig(parsedContent.artifactAi);
  state.sqlEditor.setConfig(parsedContent.sqlEditor);
  state.mosaicDashboard.setConfig(parsedContent.mosaicDashboard);
  state.artifacts.setConfig({
    ...parsedContent.artifacts,
    currentArtifactId:
      currentDocumentId ??
      parsedContent.artifacts.currentArtifactId ??
      parsedContent.artifacts.artifactOrder[0],
  });
  state.blockDocuments.setConfig(parsedContent.blockDocuments);

  for (const document of Object.values(
    parsedContent.blockDocuments.artifacts,
  )) {
    ensureStatefulBlocksForContent(store.getState(), document.content);
  }
}

export function serializeWorkspaceRoomContent(
  state: WorkspaceContentRoomState,
): JsonObject {
  return {
    artifacts: state.artifacts.config,
    blockDocuments: state.blockDocuments.config,
    sqlEditor: state.sqlEditor.config,
    mosaicDashboard: state.mosaicDashboard.config,
    artifactAi: state.artifactAi.config,
  } as unknown as JsonObject;
}

export function createDefaultWorkspaceContent({
  documentContent = createDefaultDocumentContent() as unknown as BlockDocumentContent,
  documentId = DEFAULT_DOCUMENT_ID,
  documentTitle = DEFAULT_DOCUMENT_TITLE,
}: {
  documentContent?: BlockDocumentContent;
  documentId?: string;
  documentTitle?: string;
} = {}): WorkspaceContent {
  return {
    artifacts: {
      artifactsById: {
        [documentId]: {
          id: documentId,
          type: DOCUMENT_ARTIFACT_TYPE,
          title: documentTitle,
        },
      },
      artifactOrder: [documentId],
      pinnedArtifactIds: [],
      currentArtifactId: documentId,
    },
    blockDocuments: {
      artifacts: {
        [documentId]: {
          id: documentId,
          content: documentContent,
          assets: {},
          updatedAt: Date.now(),
        },
      },
    },
    sqlEditor: createEmptyPersistedSqlEditorConfig(),
    mosaicDashboard: {dashboardsById: {}},
    artifactAi: {sessionArtifactLinks: []},
  };
}

export function getWorkspaceContentDocuments(
  content: JsonObject | undefined,
): WorkspaceDocument[] {
  const parsedContent =
    parseWorkspaceContent(content) ?? createDefaultWorkspaceContent();
  const orderedDocumentIds = [
    ...parsedContent.artifacts.artifactOrder,
    ...Object.keys(parsedContent.artifacts.artifactsById).filter(
      (artifactId) =>
        !parsedContent.artifacts.artifactOrder.includes(artifactId),
    ),
  ].filter(
    (artifactId) =>
      parsedContent.artifacts.artifactsById[artifactId]?.type ===
      DOCUMENT_ARTIFACT_TYPE,
  );

  return orderedDocumentIds.map((documentId) => {
    const artifact = parsedContent.artifacts.artifactsById[documentId];
    const blockDocument =
      parsedContent.blockDocuments.artifacts[documentId]?.content;

    return {
      id: documentId,
      title: artifact?.title ?? DEFAULT_DOCUMENT_TITLE,
      content: (blockDocument ?? {type: 'doc', content: []}) as JsonObject,
    };
  });
}

export function getWorkspaceHydrationKey(content: JsonObject | undefined) {
  return JSON.stringify(content ?? createDefaultWorkspaceContent());
}

export function parseWorkspaceContent(content: JsonObject | undefined) {
  if (!content) return null;
  const record = content;
  const artifacts = ArtifactsSliceConfig.safeParse(record.artifacts);
  const blockDocuments = BlockDocumentsSliceConfig.safeParse(
    record.blockDocuments,
  );
  const sqlEditor = SqlEditorSliceConfig.safeParse(record.sqlEditor);
  const mosaicDashboard = MosaicDashboardSliceConfig.safeParse(
    record.mosaicDashboard,
  );
  const artifactAi = ArtifactAiConfig.safeParse(record.artifactAi);

  if (
    !artifacts.success ||
    !blockDocuments.success ||
    !sqlEditor.success ||
    !mosaicDashboard.success ||
    !artifactAi.success ||
    Object.values(artifacts.data.artifactsById).some(
      (artifact) => artifact.type !== DOCUMENT_ARTIFACT_TYPE,
    )
  ) {
    return null;
  }

  return {
    artifacts: artifacts.data,
    blockDocuments: blockDocuments.data,
    sqlEditor: sqlEditor.data,
    mosaicDashboard: mosaicDashboard.data,
    artifactAi: artifactAi.data,
  } satisfies WorkspaceContent;
}
