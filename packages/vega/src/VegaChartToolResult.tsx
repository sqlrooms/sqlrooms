import {useStoreWithAi} from '@sqlrooms/ai';
import {cn} from '@sqlrooms/ui';
import {useCallback, useState} from 'react';
import {EmbedOptions, VisualizationSpec} from 'vega-embed';
import {VegaChartContainer} from './editor/VegaChartContainer';
import {VegaChartDisplay} from './editor/VegaChartDisplay';
import {EditorMode} from './editor/types';
import {VegaEditAction} from './VegaEditAction';
import {VegaExportAction} from './VegaExportAction';
import {VegaLiteArrowChart} from './VegaLiteArrowChart';

export type VegaChartToolResultProps = {
  className?: string;
  reasoning: string;
  sqlQuery: string;
  vegaLiteSpec: VisualizationSpec;
  options?: EmbedOptions;
  /**
   * Tool call ID for AI slice integration (enables persistence)
   */
  toolCallId?: string;
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
 * @param {VegaChartToolResultProps} props - The component props
 * @returns {JSX.Element} The rendered chart tool call
 */
export function VegaChartToolResult({
  className,
  sqlQuery,
  vegaLiteSpec,
  options,
  toolCallId,
  editable = true,
  editorMode = 'both',
}: VegaChartToolResultProps) {
  // AI slice integration for persisting changes
  const setToolAdditionalData = useStoreWithAi(
    (s) => s.ai.setSessionToolAdditionalData,
  );
  const currentSession = useStoreWithAi((s) => s.ai.getCurrentSession());
  const currentSessionId = currentSession?.id;

  // Track applied values for callbacks (to persist both spec and sql together)
  const [appliedSpec, setAppliedSpec] = useState(vegaLiteSpec);
  const [appliedSql, setAppliedSql] = useState(sqlQuery);

  // Callbacks to persist changes to AI slice
  const handleSpecChange = useCallback(
    (newSpec: VisualizationSpec) => {
      setAppliedSpec(newSpec);
      if (toolCallId && currentSessionId) {
        setToolAdditionalData(currentSessionId, toolCallId, {
          sqlQuery: appliedSql,
          vegaLiteSpec: newSpec,
        });
      }
    },
    [toolCallId, currentSessionId, appliedSql, setToolAdditionalData],
  );

  const handleSqlChange = useCallback(
    (newSql: string) => {
      setAppliedSql(newSql);
      if (toolCallId && currentSessionId) {
        setToolAdditionalData(currentSessionId, toolCallId, {
          sqlQuery: newSql,
          vegaLiteSpec: appliedSpec,
        });
      }
    },
    [toolCallId, currentSessionId, appliedSpec, setToolAdditionalData],
  );

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <VegaChartContainer
        spec={vegaLiteSpec}
        sqlQuery={sqlQuery}
        options={options}
        editable={editable}
        onSpecChange={handleSpecChange}
        onSqlChange={handleSqlChange}
      >
        {/* Chart with actions toolbar */}
        <div className="relative min-h-[300px]">
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
