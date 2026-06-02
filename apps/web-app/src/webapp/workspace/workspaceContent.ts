import {
  ArtifactsSliceConfig,
  type ArtifactsSliceState,
  type ArtifactsSliceConfig as ArtifactsSliceConfigType,
} from '@sqlrooms/artifacts';
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
import {createDefaultWorksheetContent} from '../worksheet/defaultBlockDocument';
import {
  createEmptyPersistedSqlEditorConfig,
  ensureStatefulBlocksForContent,
} from '../worksheet/worksheetState';

export type WorkspaceWorksheet = {
  id: string;
  title: string;
  content: JsonObject;
};

export type WorkspaceContent = {
  artifacts: ArtifactsSliceConfigType;
  blockDocuments: BlockDocumentsSliceConfigType;
  sqlEditor: SqlEditorSliceConfig;
  mosaicDashboard: MosaicDashboardSliceConfigType;
};

export type WorkspaceContentRoomState = ArtifactsSliceState &
  BlockDocumentsSliceState &
  SqlEditorSliceState &
  MosaicDashboardSliceState;

const DEFAULT_WORKSHEET_ID = 'default-worksheet';

export function hydrateWorkspaceContent({
  content,
  currentWorksheetId,
  store,
}: {
  content: JsonObject | undefined;
  currentWorksheetId?: string;
  store: {getState: () => WorkspaceContentRoomState};
}) {
  const parsedContent =
    parseWorkspaceContent(content) ?? createDefaultWorkspaceContent();
  const state = store.getState();

  state.sqlEditor.setConfig(parsedContent.sqlEditor);
  state.mosaicDashboard.setConfig(parsedContent.mosaicDashboard);
  state.artifacts.setConfig({
    ...parsedContent.artifacts,
    currentArtifactId:
      currentWorksheetId ??
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
  } as unknown as JsonObject;
}

export function createDefaultWorkspaceContent({
  worksheetContent = createDefaultWorksheetContent() as unknown as BlockDocumentContent,
  worksheetId = DEFAULT_WORKSHEET_ID,
  worksheetTitle = 'Worksheet',
}: {
  worksheetContent?: BlockDocumentContent;
  worksheetId?: string;
  worksheetTitle?: string;
} = {}): WorkspaceContent {
  return {
    artifacts: {
      artifactsById: {
        [worksheetId]: {
          id: worksheetId,
          type: 'worksheet',
          title: worksheetTitle,
          visibility: 'workspace',
        },
      },
      artifactOrder: [worksheetId],
      currentArtifactId: worksheetId,
    },
    blockDocuments: {
      artifacts: {
        [worksheetId]: {
          id: worksheetId,
          content: worksheetContent,
          assets: {},
          updatedAt: Date.now(),
        },
      },
    },
    sqlEditor: createEmptyPersistedSqlEditorConfig(),
    mosaicDashboard: {dashboardsById: {}},
  };
}

export function getWorkspaceContentWorksheets(
  content: JsonObject | undefined,
): WorkspaceWorksheet[] {
  const parsedContent =
    parseWorkspaceContent(content) ?? createDefaultWorkspaceContent();
  const orderedWorksheetIds = [
    ...parsedContent.artifacts.artifactOrder,
    ...Object.keys(parsedContent.artifacts.artifactsById).filter(
      (artifactId) =>
        !parsedContent.artifacts.artifactOrder.includes(artifactId),
    ),
  ].filter(
    (artifactId) =>
      parsedContent.artifacts.artifactsById[artifactId]?.type === 'worksheet',
  );

  return orderedWorksheetIds.map((worksheetId) => {
    const artifact = parsedContent.artifacts.artifactsById[worksheetId];
    const blockDocument =
      parsedContent.blockDocuments.artifacts[worksheetId]?.content;

    return {
      id: worksheetId,
      title: artifact?.title ?? 'Worksheet',
      content: (blockDocument ?? {type: 'doc', content: []}) as JsonObject,
    };
  });
}

export function getWorkspaceHydrationKey(content: JsonObject | undefined) {
  return JSON.stringify(content ?? createDefaultWorkspaceContent());
}

export function parseWorkspaceContent(content: JsonObject | undefined) {
  if (!content) return null;
  const record = content as Record<string, unknown>;
  const artifacts = ArtifactsSliceConfig.safeParse(record.artifacts);
  const blockDocuments = BlockDocumentsSliceConfig.safeParse(
    record.blockDocuments,
  );
  const sqlEditor = SqlEditorSliceConfig.safeParse(record.sqlEditor);
  const mosaicDashboard = MosaicDashboardSliceConfig.safeParse(
    record.mosaicDashboard,
  );

  if (
    !artifacts.success ||
    !blockDocuments.success ||
    !sqlEditor.success ||
    !mosaicDashboard.success
  ) {
    return null;
  }

  return {
    artifacts: artifacts.data,
    blockDocuments: blockDocuments.data,
    sqlEditor: sqlEditor.data,
    mosaicDashboard: mosaicDashboard.data,
  } satisfies WorkspaceContent;
}
