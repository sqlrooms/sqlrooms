import {
  createArtifactContextAiTools as createReusableArtifactContextAiTools,
  makeArtifactPrimaryForAiRun as makeReusableArtifactPrimaryForAiRun,
  type ArtifactContextToolExecutionContext,
  type ArtifactContextToolsOptions,
} from '@sqlrooms/artifacts/ai';
import type {StoreApi} from 'zustand';
import {
  DEFAULT_CLI_CAPABILITY_PROFILE,
  type CliCapabilityProfile,
} from '../profiles';
import type {RoomState} from '../store-types';

function readCliArtifact({
  state,
  artifactId,
  store,
}: {
  state: RoomState;
  artifactId: string;
  store: StoreApi<RoomState>;
}) {
  const artifact = state.artifacts.config.artifactsById[artifactId];
  if (!artifact) {
    return {
      success: false as const,
      errorMessage: `Unknown artifact "${artifactId}".`,
    };
  }

  if (artifact.type === 'markdown') {
    const document = state.documents.getDocument(artifactId);
    return {
      success: true as const,
      artifact: {
        artifactId,
        title: artifact.title,
        type: artifact.type,
      },
      payload: {
        kind: 'markdown',
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

  if (artifact.type === 'block-document') {
    const document = state.blockDocuments.getBlockDocument(artifactId);
    return {
      success: true as const,
      artifact: {
        artifactId,
        title: artifact.title,
        type: artifact.type,
      },
      payload: {
        kind: 'document',
        blocks: state.blockDocuments.getBlocks(artifactId),
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
    let query = state.sqlEditor.config.queries.find(
      (candidate: {id?: string}) => candidate.id === artifactId,
    );
    let result = state.sqlEditor.queryResultsById[artifactId];
    if (!query) {
      const ensuredQuery = state.sqlEditor.ensureQuery(artifactId, {
        name: artifact.title,
      });
      const nextState = store.getState();
      query =
        nextState.sqlEditor.config.queries.find(
          (candidate: {id?: string}) => candidate.id === artifactId,
        ) ?? ensuredQuery;
      result = nextState.sqlEditor.queryResultsById[artifactId];
    }
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
        'This artifact type is available as context, but read_context_artifact only returns full payloads for document, document, and dashboard artifacts in v1.',
    },
  };
}

function createArtifactContextOptions(
  store: StoreApi<RoomState>,
  profile: CliCapabilityProfile,
): ArtifactContextToolsOptions<RoomState> {
  const supportedArtifactTypes = new Set<string>(profile.artifacts.runContext);
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
    readArtifact: ({state, artifactId}) =>
      readCliArtifact({state, artifactId, store}),
    isArtifactAllowed: ({artifact}) =>
      supportedArtifactTypes.has(artifact.type),
  };
}

export function makeArtifactPrimaryForAiRun(
  store: StoreApi<RoomState>,
  artifactId: string,
  context?: ArtifactContextToolExecutionContext,
  profile: CliCapabilityProfile = DEFAULT_CLI_CAPABILITY_PROFILE,
) {
  return makeReusableArtifactPrimaryForAiRun(
    createArtifactContextOptions(store, profile),
    artifactId,
    context,
  );
}

export function createArtifactContextAiTools(
  store: StoreApi<RoomState>,
  profile: CliCapabilityProfile = DEFAULT_CLI_CAPABILITY_PROFILE,
) {
  return createReusableArtifactContextAiTools(
    createArtifactContextOptions(store, profile),
  );
}
