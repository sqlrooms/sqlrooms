import {
  createArtifactContextAiTools as createReusableArtifactContextAiTools,
  makeArtifactPrimaryForAiRun as makeReusableArtifactPrimaryForAiRun,
  type ArtifactContextToolExecutionContext,
  type ArtifactContextToolsOptions,
} from '@sqlrooms/artifacts/ai';
import type {StoreApi} from 'zustand';
import type {RoomState} from '../store-types';

function readCliArtifact({
  state,
  artifactId,
}: {
  state: RoomState;
  artifactId: string;
}) {
  const artifact = state.artifacts.config.artifactsById[artifactId];
  if (!artifact) {
    return {
      success: false as const,
      errorMessage: `Unknown artifact "${artifactId}".`,
    };
  }

  if (artifact.type === 'document') {
    const document = state.documents.getDocument(artifactId);
    return {
      success: true as const,
      artifact: {
        artifactId,
        title: artifact.title,
        type: artifact.type,
      },
      payload: {
        kind: 'document',
        markdown: document?.markdown ?? '',
        assets: Object.values(document?.assets ?? {}).map((asset) => ({
          id: asset.id,
          filename: asset.filename,
          mediaType: asset.mediaType,
          encoding: asset.encoding,
          alt: asset.alt,
          title: asset.title,
          createdAt: asset.createdAt,
          updatedAt: asset.updatedAt,
        })),
        updatedAt: document?.updatedAt,
      },
    };
  }

  if (artifact.type === 'worksheet') {
    const worksheet = state.blockDocuments.getBlockDocument(artifactId);
    return {
      success: true as const,
      artifact: {
        artifactId,
        title: artifact.title,
        type: artifact.type,
      },
      payload: {
        kind: 'worksheet',
        blocks: state.blockDocuments.getBlocks(artifactId),
        assets: Object.values(worksheet?.assets ?? {}).map((asset) => ({
          id: asset.id,
          filename: asset.filename,
          mediaType: asset.mediaType,
          encoding: asset.encoding,
          alt: asset.alt,
          title: asset.title,
          createdAt: asset.createdAt,
          updatedAt: asset.updatedAt,
        })),
        updatedAt: worksheet?.updatedAt,
      },
    };
  }

  if (artifact.type === 'dashboard') {
    state.dashboard.ensureDashboardArtifact(artifactId);
    const dashboard = state.mosaicDashboard.getDashboard(artifactId);
    return {
      success: true as const,
      artifact: {
        artifactId,
        title: artifact.title,
        type: artifact.type,
      },
      payload: {
        kind: 'dashboard',
        layoutType: dashboard?.layoutType,
        selectedTable: dashboard?.selectedTable,
        panelCount: dashboard?.panels.length ?? 0,
        panels: (dashboard?.panels ?? []).map((panel) => ({
          id: panel.id,
          type: panel.type,
          title: panel.title,
          config: panel.config,
        })),
      },
    };
  }

  if (artifact.type === 'sql-query') {
    const query = state.sqlEditor.config.queries.find(
      (candidate) => candidate.id === artifactId,
    );
    const result = state.sqlEditor.queryResultsById[artifactId];
    return {
      success: true as const,
      artifact: {
        artifactId,
        title: artifact.title,
        type: artifact.type,
      },
      payload: {
        kind: 'sql-query',
        name: query?.name ?? artifact.title,
        query: query?.query ?? '',
        resultStatus: result?.status,
        lastQueryStatement:
          result?.status === 'success' ? result.lastQueryStatement : undefined,
      },
    };
  }

  return {
    success: true as const,
    artifact: {
      artifactId,
      title: artifact.title,
      type: artifact.type,
    },
    payload: {
      kind: 'metadata-only',
      unsupportedPayload: true,
      details:
        'This artifact type is available as context, but read_context_artifact only returns full payloads for worksheet, document, and dashboard artifacts in v1.',
    },
  };
}

function createArtifactContextOptions(
  store: StoreApi<RoomState>,
): ArtifactContextToolsOptions<RoomState> {
  const getContextSessionId = (
    state: RoomState,
    context?: ArtifactContextToolExecutionContext,
  ) => context?.sessionId ?? state.ai.getCurrentSession()?.id;

  return {
    store,
    getRunContext: ({state, context}) => {
      const sessionId = getContextSessionId(state, context);
      return sessionId
        ? state.ai.getSessionRunContext(sessionId)
        : state.ai.getCurrentSession()?.runContext;
    },
    setRunContext: ({state, context, runContext}) => {
      const sessionId = getContextSessionId(state, context);
      if (sessionId) {
        state.ai.setSessionRunContext(sessionId, runContext);
      }
    },
    onContextItemsChanged: ({state, items}) => {
      state.setAiContextItemIds(
        items.map((item) => item.id),
        'manual',
      );
    },
    readArtifact: ({state, artifactId}) => readCliArtifact({state, artifactId}),
  };
}

export function makeArtifactPrimaryForAiRun(
  store: StoreApi<RoomState>,
  artifactId: string,
  context?: ArtifactContextToolExecutionContext,
) {
  return makeReusableArtifactPrimaryForAiRun(
    createArtifactContextOptions(store),
    artifactId,
    context,
  );
}

export function createArtifactContextAiTools(store: StoreApi<RoomState>) {
  return createReusableArtifactContextAiTools(
    createArtifactContextOptions(store),
  );
}
