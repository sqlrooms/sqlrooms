import {
  getAiRunContextItems,
  getAiRunContextPrimaryItem,
  setAiRunContextPrimaryItem,
  type AiRunContext,
  type AiRunContextItem,
  type AiToolExecutionContext,
} from '@sqlrooms/ai';
import {tool} from 'ai';
import {z} from 'zod';
import type {StoreApi} from 'zustand';
import type {RoomState} from './store-types';

const EmptyInput = z.object({});

const ReadContextArtifactInput = z
  .object({
    artifactId: z
      .string()
      .optional()
      .describe('Context artifact ID. Defaults to the primary context artifact.'),
  });

const SetPrimaryContextArtifactInput = z.object({
  artifactId: z.string().describe('Artifact ID to make primary for this run.'),
});

type ContextArtifactRole = 'primary' | 'reference';

function getExecutionRunContext(
  state: RoomState,
  context?: AiToolExecutionContext,
): AiRunContext | undefined {
  return (
    context?.getAiRunContext?.() ??
    context?.aiRunContext ??
    state.ai.getCurrentSession()?.runContext
  );
}

function artifactToContextItem(
  state: RoomState,
  artifactId: string,
): AiRunContextItem | undefined {
  const artifact = state.artifacts.config.artifactsById[artifactId];
  if (!artifact) return undefined;
  return {
    kind: 'artifact',
    id: artifact.id,
    type: artifact.type,
    title: artifact.title,
  };
}

function contextArtifactSummary(
  state: RoomState,
  item: AiRunContextItem,
  primaryItemId: string | undefined,
) {
  const artifact = state.artifacts.config.artifactsById[item.id];
  return {
    kind: item.kind,
    artifactId: item.id,
    id: item.id,
    title: artifact?.title ?? item.title,
    type: artifact?.type ?? item.type,
    role:
      item.id === primaryItemId
        ? ('primary' as ContextArtifactRole)
        : ('reference' as ContextArtifactRole),
    missing: !artifact,
    ...(item.subtitle ? {subtitle: item.subtitle} : {}),
  };
}

function readArtifactPayload(state: RoomState, artifactId: string) {
  const artifact = state.artifacts.config.artifactsById[artifactId];
  if (!artifact) {
    return {
      success: false,
      errorMessage: `Unknown artifact "${artifactId}".`,
    };
  }

  if (artifact.type === 'document') {
    const document = state.documents.getDocument(artifactId);
    return {
      success: true,
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

  if (artifact.type === 'dashboard') {
    state.dashboard.ensureDashboardArtifact(artifactId);
    const dashboard = state.mosaicDashboard.getDashboard(artifactId);
    return {
      success: true,
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
          source: panel.source,
          config: panel.config,
        })),
      },
    };
  }

  return {
    success: true,
    artifact: {
      artifactId,
      title: artifact.title,
      type: artifact.type,
    },
    payload: {
      kind: 'metadata-only',
      unsupportedPayload: true,
      details:
        'This artifact type is available as context, but read_context_artifact only returns full payloads for document and dashboard artifacts in v1.',
    },
  };
}

function setPrimaryArtifact(
  state: RoomState,
  context: AiToolExecutionContext | undefined,
  artifactId: string,
) {
  const item = artifactToContextItem(state, artifactId);
  if (!item) {
    return {
      success: false,
      errorMessage: `Unknown artifact "${artifactId}".`,
    };
  }

  const runContext = getExecutionRunContext(state, context);
  const nextContext = setAiRunContextPrimaryItem(runContext, item);
  if (context?.setAiRunContext) {
    context.setAiRunContext(nextContext);
  } else if (context?.setPrimaryRunContextItem) {
    context.setPrimaryRunContextItem(item);
  } else {
    const sessionId = context?.sessionId ?? state.ai.getCurrentSession()?.id;
    if (sessionId) {
      state.ai.setSessionRunContext(sessionId, nextContext);
    }
  }

  state.setAiContextItemIds(
    getAiRunContextItems(nextContext)
      .filter((contextItem) => contextItem.kind === 'artifact')
      .map((contextItem) => contextItem.id),
    'manual',
  );

  return {
    success: true,
    context: nextContext,
    item,
  };
}

export function makeArtifactPrimaryForAiRun(
  store: StoreApi<RoomState>,
  artifactId: string,
  context?: AiToolExecutionContext,
) {
  return setPrimaryArtifact(store.getState(), context, artifactId);
}

export function createArtifactContextAiTools(store: StoreApi<RoomState>) {
  return {
    list_context_artifacts: tool({
      description:
        'List artifacts that the user added to the current AI run context, including which artifact is primary.',
      inputSchema: EmptyInput,
      execute: async (_params, options) => {
        const context = options as AiToolExecutionContext | undefined;
        const state = store.getState();
        const runContext = getExecutionRunContext(state, context);
        const primaryItem = getAiRunContextPrimaryItem(runContext);
        const artifacts = getAiRunContextItems(runContext)
          .filter((item) => item.kind === 'artifact')
          .map((item) =>
            contextArtifactSummary(state, item, primaryItem?.id),
          );

        return {
          llmResult: {
            success: true,
            primaryArtifactId: primaryItem?.id,
            artifacts,
            details: `Found ${artifacts.length} context artifact${artifacts.length === 1 ? '' : 's'}.`,
          },
        };
      },
    }),
    read_context_artifact: tool({
      description:
        'Read one artifact from the current AI run context. Defaults to the primary artifact. Use list_context_artifacts first when unsure.',
      inputSchema: ReadContextArtifactInput,
      execute: async (params, options) => {
        const context = options as AiToolExecutionContext | undefined;
        const state = store.getState();
        const runContext = getExecutionRunContext(state, context);
        const items = getAiRunContextItems(runContext).filter(
          (item) => item.kind === 'artifact',
        );
        const requestedArtifactId =
          params.artifactId ?? getAiRunContextPrimaryItem(runContext)?.id;
        if (!requestedArtifactId) {
          return {
            llmResult: {
              success: false,
              errorMessage:
                'No context artifact is available. Add an artifact to context or provide one with set_primary_context_artifact first.',
            },
          };
        }
        if (!items.some((item) => item.id === requestedArtifactId)) {
          return {
            llmResult: {
              success: false,
              errorMessage: `Artifact "${requestedArtifactId}" is not in the current run context. Use set_primary_context_artifact before reading it as context.`,
            },
          };
        }

        return {
          llmResult: readArtifactPayload(state, requestedArtifactId),
        };
      },
    }),
    set_primary_context_artifact: tool({
      description:
        'Make an existing artifact the primary artifact for this AI run. Use after creating a new artifact or when the user asks to work on a specific artifact.',
      inputSchema: SetPrimaryContextArtifactInput,
      execute: async (params, options) => {
        const context = options as AiToolExecutionContext | undefined;
        const state = store.getState();
        const result = setPrimaryArtifact(state, context, params.artifactId);
        if (!result.success || !result.item || !result.context) {
          return {
            llmResult: result,
          };
        }

        return {
          llmResult: {
            success: true,
            primaryArtifactId: result.item.id,
            contextItems: getAiRunContextItems(result.context),
            details: `Set artifact "${result.item.title}" (${result.item.id}) as the primary context artifact.`,
          },
        };
      },
    }),
  };
}
