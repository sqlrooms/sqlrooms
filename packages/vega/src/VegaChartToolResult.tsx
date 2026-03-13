import {useStoreWithAi} from '@sqlrooms/ai';
import type {ToolRendererProps} from '@sqlrooms/ai-core';
import {cn} from '@sqlrooms/ui';
import {ReactNode, useCallback, useState} from 'react';
import {EmbedOptions, VisualizationSpec} from 'vega-embed';
import {VegaChartContainer} from './editor/VegaChartContainer';
import {VegaChartDisplay} from './editor/VegaChartDisplay';
import {EditorMode} from './editor/types';
import type {
  VegaChartToolOutput,
  VegaChartToolParameters,
} from './VegaChartTool';
import {VegaEditAction} from './VegaEditAction';
import {VegaExportAction} from './VegaExportAction';
import {VegaLiteArrowChart} from './VegaLiteArrowChart';

export type VegaChartToolResultProps = ToolRendererProps<
  VegaChartToolOutput,
  VegaChartToolParameters
> & {
  className?: string;
  options?: EmbedOptions;
  /**
   * Whether editing is enabled
   * @default true
   */
  editable?: boolean;
  /**
   * Which editors to show when editing
   * @default 'both'
   */
  editorMode?: EditorMode;
};

/**
 * Renders a chart tool call with visualization using Vega-Lite.
 * Supports inline editing with AI slice persistence.
 *
 * @param props - The component props
 * @returns The rendered chart tool call
 */
export function VegaChartToolResult({
  className,
  output,
  toolCallId,
  options,
  editable = true,
  editorMode = 'both',
}: VegaChartToolResultProps): ReactNode {
  // AI slice integration for persisting changes
  const setToolEditState = useStoreWithAi((s) => s.ai.setToolEditState);
  const currentSession = useStoreWithAi((s) => s.ai.getCurrentSession());
  const currentSessionId = currentSession?.id;

  // Resolve initial values: prefer saved edits from toolEditState, fall back to output.
  // NOTE: This reads directly from the store rather than through ToolRendererProps because
  // edit state is mutable UI data that changes independently of the tool output. A future
  // enhancement could add an optional `editState` field to ToolRendererProps to decouple this.
  const savedEdits = currentSession?.toolEditState?.[toolCallId] as
    | {sqlQuery?: string; vegaLiteSpec?: VisualizationSpec}
    | undefined;

  const initialSqlQuery = savedEdits?.sqlQuery ?? output?.sqlQuery ?? '';
  const initialVegaLiteSpec =
    (savedEdits?.vegaLiteSpec as VisualizationSpec) ??
    (output?.vegaLiteSpec as VisualizationSpec | null);

  // Track applied values for callbacks (to persist both spec and sql together)
  const [appliedSpec, setAppliedSpec] = useState<VisualizationSpec | null>(
    initialVegaLiteSpec,
  );
  const [appliedSql, setAppliedSql] = useState(initialSqlQuery);

  // Callbacks to persist changes to AI slice
  const handleSpecChange = useCallback(
    (newSpec: VisualizationSpec) => {
      setAppliedSpec(newSpec);
      if (toolCallId && currentSessionId) {
        setToolEditState(currentSessionId, toolCallId, {
          sqlQuery: appliedSql,
          vegaLiteSpec: newSpec,
        });
      }
    },
    [toolCallId, currentSessionId, appliedSql, setToolEditState],
  );

  const handleSqlChange = useCallback(
    (newSql: string) => {
      setAppliedSql(newSql);
      if (toolCallId && currentSessionId) {
        setToolEditState(currentSessionId, toolCallId, {
          sqlQuery: newSql,
          vegaLiteSpec: appliedSpec,
        });
      }
    },
    [toolCallId, currentSessionId, appliedSpec, setToolEditState],
  );

  if (!initialVegaLiteSpec) {
    return null;
  }

  return (
    <div className={cn('flex max-w-full flex-col gap-2', className)}>
      <VegaChartContainer
        spec={initialVegaLiteSpec}
        sqlQuery={initialSqlQuery}
        options={options}
        editable={editable}
        onSpecChange={handleSpecChange}
        onSqlChange={handleSqlChange}
      >
        {/* Chart with actions toolbar */}
        <div className="relative max-w-full overflow-x-auto">
          <VegaChartDisplay aspectRatio={16 / 9} className="pt-2">
            <VegaLiteArrowChart.Actions className="right-3">
              <VegaExportAction />
              {editable && <VegaEditAction editorMode={editorMode} />}
            </VegaLiteArrowChart.Actions>
          </VegaChartDisplay>
        </div>
      </VegaChartContainer>
    </div>
  );
}
