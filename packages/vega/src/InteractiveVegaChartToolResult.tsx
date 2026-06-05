import type {ToolRendererProps} from '@sqlrooms/ai-core';
import {useStoreWithAi} from '@sqlrooms/ai-core';
import {cn} from '@sqlrooms/ui';
import type {UIMessage} from 'ai';
import {produce} from 'immer';
import {ReactNode, useCallback, useEffect, useRef, useState} from 'react';
import {EmbedOptions, VisualizationSpec} from 'vega-embed';
import {EditorMode} from './editor/types';
import {VegaChartContainer} from './editor/VegaChartContainer';
import {VegaChartDisplay} from './editor/VegaChartDisplay';
import type {
  VegaChartToolOutput,
  VegaChartToolParameters,
} from './VegaChartTool';
import {VegaChartActions} from './VegaChartActions';
import {VegaEditAction} from './VegaEditAction';
import {VegaExportAction} from './VegaExportAction';
import {VegaInteractiveEdit} from './VegaInteractiveEdit';

/**
 * Module-level cache for edited chart specs, keyed by `toolCallId`.
 *
 * Survives component re-mounts within the same app session and acts as the
 * authoritative source for in-progress edits before they are persisted back to
 * the AI session messages.
 */
const editedSpecCache = new Map<string, VisualizationSpec>();

export type InteractiveVegaChartToolResultProps = ToolRendererProps<
  VegaChartToolOutput,
  VegaChartToolParameters
> & {
  className?: string;
  options?: EmbedOptions;
  /**
   * Which editors to show in the spec/SQL popover editor.
   * @default 'both'
   */
  editorMode?: EditorMode;
  /**
   * Debounce (ms) before persisting interactive edits back to the AI session.
   * @default 500
   */
  persistDebounceMs?: number;
};

/**
 * Configuration accepted by {@link createInteractiveVegaChartToolResult}.
 */
export type InteractiveVegaChartToolResultOptions = {
  /**
   * Which editors to show in the spec/SQL popover editor.
   * @default 'both'
   */
  editorMode?: EditorMode;
  /**
   * Debounce (ms) before persisting interactive edits back to the AI session.
   * @default 500
   */
  persistDebounceMs?: number;
  /**
   * Default Vega embed options applied to the rendered chart.
   */
  options?: EmbedOptions;
};

/**
 * Chart tool renderer with WYSIWYG interactive editing.
 *
 * This is an **optional, opt-in** alternative to {@link VegaChartToolResult}.
 * Use it as the `chart` tool renderer when you want users to edit the rendered
 * chart in place:
 * - **Edit title** — double-click the title to rename it
 * - **Drag labels** — reposition data labels
 * - **Delete labels** — remove individual data labels
 *
 * Edits are applied to a local copy of the spec for immediate feedback and
 * debounced-persisted back into the current AI session's `uiMessages`, so they
 * survive reloads and re-renders. Persistence uses the public AI slice API
 * (`getCurrentSession` / `setSessionUiMessages`) and is therefore portable
 * across any room store that includes the AI slice.
 *
 * For configurable defaults (editor mode, debounce, embed options) use
 * {@link createInteractiveVegaChartToolResult}.
 *
 * @example
 * ```tsx
 * createAiSlice({
 *   toolRenderers: {
 *     ...createDefaultAiToolRenderers(),
 *     // Opt in to interactive editing (otherwise keep VegaChartToolResult):
 *     chart: InteractiveVegaChartToolResult,
 *   },
 *   tools: {
 *     ...createDefaultAiTools(store),
 *     chart: createVegaChartTool(),
 *   },
 * });
 * ```
 */
export function InteractiveVegaChartToolResult({
  className,
  input,
  output,
  toolCallId,
  options,
  editorMode = 'both',
  persistDebounceMs = 500,
}: InteractiveVegaChartToolResultProps): ReactNode {
  const sqlQuery = output?.sqlQuery ?? '';
  const vegaLiteSpec = output?.vegaLiteSpec as VisualizationSpec | null;

  const getCurrentSession = useStoreWithAi((s) => s.ai.getCurrentSession);
  const setSessionUiMessages = useStoreWithAi(
    (s) => s.ai.setSessionUiMessages,
  );

  // Initialize from the edit cache (if previously edited) or the tool output.
  const [editedSpec, setEditedSpec] = useState<VisualizationSpec | null>(
    () => editedSpecCache.get(toolCallId) ?? null,
  );

  // The tool output may not carry `vegaLiteSpec` on the first render (e.g. while
  // the tool call is still streaming). Derive the active spec during render so it
  // is adopted as soon as it becomes available, without requiring a remount or an
  // effect. A user edit (tracked in `editedSpec`) always wins over the tool output.
  const currentSpec =
    editedSpec ?? editedSpecCache.get(toolCallId) ?? vegaLiteSpec;

  // Keep a ref to the live output object so the persistence mutation can also
  // patch the in-memory message carried by useChat.
  const liveOutputRef = useRef(output as Record<string, unknown> | undefined);
  useEffect(() => {
    liveOutputRef.current = output as Record<string, unknown> | undefined;
  }, [output]);

  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSpecChange = useCallback(
    (newSpec: VisualizationSpec) => {
      setEditedSpec(newSpec);
      editedSpecCache.set(toolCallId, newSpec);

      if (persistTimeoutRef.current) {
        clearTimeout(persistTimeoutRef.current);
      }
      persistTimeoutRef.current = setTimeout(() => {
        // Mutate the live output object so useChat's in-memory messages carry
        // the edit until the next sync.
        if (liveOutputRef.current) {
          liveOutputRef.current.vegaLiteSpec = newSpec;
        }

        const currentSession = getCurrentSession();
        const uiMessages = currentSession?.uiMessages as
          | UIMessage[]
          | undefined;
        if (!currentSession || !uiMessages) return;

        const nextMessages = produce(uiMessages, (draft) => {
          for (const msg of draft) {
            if (msg.role !== 'assistant' || !msg.parts) continue;
            for (const part of msg.parts) {
              const p = part as Record<string, unknown>;
              if (
                p.toolCallId === toolCallId &&
                p.state === 'output-available'
              ) {
                (p.output as Record<string, unknown>).vegaLiteSpec = newSpec;
                return;
              }
            }
          }
        });

        setSessionUiMessages(currentSession.id, nextMessages);
      }, persistDebounceMs);
    },
    [toolCallId, persistDebounceMs, getCurrentSession, setSessionUiMessages],
  );

  if (!currentSpec) {
    return null;
  }

  return (
    <div className={cn('flex max-w-full flex-col gap-2', className)}>
      {input?.reasoning && (
        <p className="text-tiny text-muted-foreground ml-4">
          {input.reasoning}
        </p>
      )}
      <VegaChartContainer
        spec={currentSpec}
        sqlQuery={sqlQuery}
        options={options}
        editable={true}
        onSpecChange={handleSpecChange}
      >
        <div className="relative max-w-full overflow-x-auto">
          <VegaChartDisplay aspectRatio={16 / 9} className="pt-2">
            <VegaChartActions className="right-3">
              <VegaInteractiveEdit
                spec={currentSpec}
                onSpecChange={handleSpecChange}
              />
              <VegaExportAction />
              <VegaEditAction editorMode={editorMode} />
            </VegaChartActions>
          </VegaChartDisplay>
        </div>
      </VegaChartContainer>
    </div>
  );
}

/**
 * Create a configured {@link InteractiveVegaChartToolResult} renderer.
 *
 * Lets you set defaults (editor mode, persistence debounce, embed options)
 * once when registering the `chart` tool renderer, while keeping interactive
 * editing entirely opt-in. Per-instance props still override these defaults.
 *
 * @example
 * ```tsx
 * createAiSlice({
 *   toolRenderers: {
 *     ...createDefaultAiToolRenderers(),
 *     chart: createInteractiveVegaChartToolResult({editorMode: 'spec'}),
 *   },
 * });
 * ```
 */
export function createInteractiveVegaChartToolResult(
  options: InteractiveVegaChartToolResultOptions = {},
) {
  function ConfiguredInteractiveVegaChartToolResult(
    props: InteractiveVegaChartToolResultProps,
  ): ReactNode {
    return (
      <InteractiveVegaChartToolResult
        editorMode={options.editorMode}
        persistDebounceMs={options.persistDebounceMs}
        options={options.options}
        {...props}
      />
    );
  }
  ConfiguredInteractiveVegaChartToolResult.displayName =
    'InteractiveVegaChartToolResult';
  return ConfiguredInteractiveVegaChartToolResult;
}

