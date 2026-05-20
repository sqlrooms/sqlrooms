/**
 * AI tool helpers for SQLRooms apps that use the artifacts slice.
 *
 * This subpath intentionally lives in `@sqlrooms/artifacts/ai` rather than
 * `@sqlrooms/ai`: the AI packages own generic run-context transport, while this
 * module owns the artifact-specific interpretation of that context. Apps supply
 * artifact payload readers for their domain types, and this module handles the
 * common assistant-facing tools for listing context artifacts, reading only
 * artifacts that were added to the run context, and updating the primary
 * artifact for the current AI run.
 *
 * @packageDocumentation
 */

import {
  getAiRunContextItems,
  getAiRunContextPrimaryItem,
  setAiRunContextPrimaryItem,
  type AiRunContext,
  type AiRunContextItem,
} from '@sqlrooms/ai-config';
import {tool} from 'ai';
import {z} from 'zod';
import type {ArtifactsSliceState} from './ArtifactsSlice';
import type {ArtifactMetadata as ArtifactMetadataType} from './ArtifactsSliceConfig';

const EmptyInput = z.object({});

const ReadContextArtifactInput = z.object({
  artifactId: z
    .string()
    .optional()
    .describe('Context artifact ID. Defaults to the primary context artifact.'),
});

const SetPrimaryContextArtifactInput = z.object({
  artifactId: z.string().describe('Artifact ID to make primary for this run.'),
});

/**
 * Hidden execution context that `@sqlrooms/ai-core` passes as the second
 * argument to AI SDK tool `execute` callbacks.
 *
 * Apps normally do not construct this object manually. It is accepted here so
 * the reusable artifact tools can read and update the current run context
 * without depending on `@sqlrooms/ai-core`.
 */
export type ArtifactContextToolExecutionContext = {
  /** AI session that owns the current tool call, when known. */
  sessionId?: string;
  /** Snapshot of the run context captured when the current AI run started. */
  aiRunContext?: AiRunContext;
  /** Returns the latest mutable run context for the current tool loop. */
  getAiRunContext?: () => AiRunContext | undefined;
  /** Replaces the latest mutable run context for the current tool loop. */
  setAiRunContext?: (runContext: AiRunContext | undefined) => void;
  /** Convenience helper for making a context item the primary run target. */
  setPrimaryRunContextItem?: (item: AiRunContextItem) => void;
};

/**
 * Minimal store interface required by the artifact context tools.
 *
 * This is intentionally narrower than Zustand's `StoreApi` so host apps can
 * pass any object that can return a state containing `ArtifactsSliceState`.
 */
export type ArtifactContextToolStore<TState extends ArtifactsSliceState> = {
  getState: () => TState;
};

/**
 * Standard result shape returned by app-provided artifact readers.
 *
 * `payload` is deliberately `unknown`: each app owns the readable shape for its
 * artifact types, such as Markdown for document artifacts or panel summaries
 * for dashboard artifacts.
 */
export type ArtifactContextReadResult =
  | {
      success: false;
      errorMessage: string;
    }
  | {
      success: true;
      artifact: {
        artifactId: string;
        title: string;
        type: string;
      };
      payload: unknown;
    };

/**
 * Adapter options for creating artifact context tools.
 *
 * The artifact package owns artifact metadata, but not app-specific artifact
 * payloads or AI session storage. These callbacks provide those seams without
 * making `@sqlrooms/artifacts` depend on higher-level packages or concrete app
 * state.
 */
export type ArtifactContextToolsOptions<TState extends ArtifactsSliceState> = {
  /** Store containing the artifacts slice and any app-specific state readers need. */
  store: ArtifactContextToolStore<TState>;
  /**
   * Fallback source for persisted run context when the AI tool execution
   * context does not provide live context helpers.
   */
  getRunContext?: (args: {
    state: TState;
    context?: ArtifactContextToolExecutionContext;
  }) => AiRunContext | undefined;
  /**
   * Fallback sink for persisted run context when the AI tool execution context
   * does not provide a live setter.
   */
  setRunContext?: (args: {
    state: TState;
    context?: ArtifactContextToolExecutionContext;
    runContext: AiRunContext | undefined;
  }) => void;
  /**
   * Called after `set_primary_context_artifact` or
   * `makeArtifactPrimaryForAiRun` changes the context item list.
   *
   * Host apps can use this to keep visible context selectors in sync with the
   * persisted run context.
   */
  onContextItemsChanged?: (args: {
    state: TState;
    context?: ArtifactContextToolExecutionContext;
    runContext: AiRunContext;
    items: AiRunContextItem[];
  }) => void;
  /**
   * Reads an artifact payload for `read_context_artifact`.
   *
   * If omitted, `read_context_artifact` returns metadata-only payloads. The
   * reader is only called after the requested artifact has been validated as
   * present in the current run context.
   */
  readArtifact?: (args: {
    state: TState;
    context?: ArtifactContextToolExecutionContext;
    artifactId: string;
    artifact: ArtifactMetadataType;
  }) => ArtifactContextReadResult | Promise<ArtifactContextReadResult>;
};

function getExecutionRunContext<TState extends ArtifactsSliceState>(
  options: ArtifactContextToolsOptions<TState>,
  state: TState,
  context?: ArtifactContextToolExecutionContext,
): AiRunContext | undefined {
  return (
    context?.getAiRunContext?.() ??
    context?.aiRunContext ??
    options.getRunContext?.({state, context})
  );
}

function artifactToContextItem<TState extends ArtifactsSliceState>(
  state: TState,
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

function contextArtifactSummary<TState extends ArtifactsSliceState>(
  state: TState,
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
    role: item.id === primaryItemId ? 'primary' : 'reference',
    missing: !artifact,
    ...(item.subtitle ? {subtitle: item.subtitle} : {}),
  };
}

function readArtifactMetadataOnly(
  artifactId: string,
  artifact: ArtifactMetadataType,
): ArtifactContextReadResult {
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
        'This artifact type is available as context, but no artifact reader was provided for its full payload.',
    },
  };
}

function setPrimaryArtifact<TState extends ArtifactsSliceState>(
  options: ArtifactContextToolsOptions<TState>,
  state: TState,
  context: ArtifactContextToolExecutionContext | undefined,
  artifactId: string,
) {
  const item = artifactToContextItem(state, artifactId);
  if (!item) {
    return {
      success: false,
      errorMessage: `Unknown artifact "${artifactId}".`,
    };
  }

  const runContext = getExecutionRunContext(options, state, context);
  const nextContext = setAiRunContextPrimaryItem(runContext, item);
  if (context?.setAiRunContext) {
    context.setAiRunContext(nextContext);
  } else if (context?.setPrimaryRunContextItem) {
    context.setPrimaryRunContextItem(item);
  } else {
    options.setRunContext?.({state, context, runContext: nextContext});
  }

  const items = getAiRunContextItems(nextContext);
  options.onContextItemsChanged?.({
    state,
    context,
    runContext: nextContext,
    items,
  });

  return {
    success: true,
    context: nextContext,
    item,
  };
}

/**
 * Programmatically make an artifact the primary artifact for the current AI run.
 *
 * Domain tools should call this after creating or selecting an artifact that
 * subsequent tool calls should treat as the default target. The helper updates
 * live AI tool context when available and falls back to the adapter's
 * `setRunContext` callback otherwise.
 *
 * @returns A success object with the updated context and primary item, or an
 * error object when the artifact id is unknown.
 */
export function makeArtifactPrimaryForAiRun<TState extends ArtifactsSliceState>(
  options: ArtifactContextToolsOptions<TState>,
  artifactId: string,
  context?: ArtifactContextToolExecutionContext,
) {
  return setPrimaryArtifact(
    options,
    options.store.getState(),
    context,
    artifactId,
  );
}

/**
 * Create reusable AI SDK tools for artifact run context.
 *
 * The returned tool set contains:
 *
 * - `list_context_artifacts`: lists context artifacts and their primary or
 *   reference role.
 * - `read_context_artifact`: reads the primary context artifact by default, or
 *   a requested artifact id if it is already in context.
 * - `set_primary_context_artifact`: validates an artifact and makes it primary
 *   for the current run.
 *
 * These tools never expose the whole artifact registry as a mutation target.
 * Reading is restricted to artifacts already present in run context, while
 * setting a primary artifact is the explicit operation that can add an existing
 * artifact to that context.
 */
export function createArtifactContextAiTools<
  TState extends ArtifactsSliceState,
>(options: ArtifactContextToolsOptions<TState>) {
  return {
    list_context_artifacts: tool({
      description:
        'List artifacts that the user added to the current AI run context, including which artifact is primary.',
      inputSchema: EmptyInput,
      execute: async (_params, executionOptions) => {
        const context =
          executionOptions as ArtifactContextToolExecutionContext | undefined;
        const state = options.store.getState();
        const runContext = getExecutionRunContext(options, state, context);
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
      execute: async (params, executionOptions) => {
        const context =
          executionOptions as ArtifactContextToolExecutionContext | undefined;
        const state = options.store.getState();
        const runContext = getExecutionRunContext(options, state, context);
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

        const artifact = state.artifacts.config.artifactsById[requestedArtifactId];
        if (!artifact) {
          return {
            llmResult: {
              success: false,
              errorMessage: `Unknown artifact "${requestedArtifactId}".`,
            },
          };
        }

        return {
          llmResult:
            (await options.readArtifact?.({
              state,
              context,
              artifactId: requestedArtifactId,
              artifact,
            })) ?? readArtifactMetadataOnly(requestedArtifactId, artifact),
        };
      },
    }),
    set_primary_context_artifact: tool({
      description:
        'Make an existing artifact the primary artifact for this AI run. Use after creating a new artifact or when the user asks to work on a specific artifact.',
      inputSchema: SetPrimaryContextArtifactInput,
      execute: async (params, executionOptions) => {
        const context =
          executionOptions as ArtifactContextToolExecutionContext | undefined;
        const state = options.store.getState();
        const result = setPrimaryArtifact(
          options,
          state,
          context,
          params.artifactId,
        );
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
