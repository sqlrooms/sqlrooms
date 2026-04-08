import type {ToolRendererProps} from '@sqlrooms/ai';
import {useStoreWithAi} from '@sqlrooms/ai';
import {cn} from '@sqlrooms/ui';
import {ReactNode, useCallback} from 'react';
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
   * Which editors to show when viewing
   * @default 'both'
   */
  editorMode?: EditorMode;
};

/**
 * Renders a chart tool call with visualization using Vega-Lite.
 * Supports inline editing of the spec and SQL query,
 * with changes persisted back to the AI conversation.
 */
export function VegaChartToolResult({
  className,
  output,
  toolCallId,
  options,
  editable = true,
  editorMode = 'both',
}: VegaChartToolResultProps): ReactNode {
  const sqlQuery = output?.sqlQuery ?? '';
  const vegaLiteSpec = output?.vegaLiteSpec as VisualizationSpec | null;
  const updateToolOutput = useStoreWithAi((s) => s.ai.updateToolOutput);

  const handleSpecChange = useCallback(
    (newSpec: VisualizationSpec) => {
      if (!output) return;
      updateToolOutput(toolCallId, {...output, vegaLiteSpec: newSpec});
    },
    [toolCallId, output, updateToolOutput],
  );

  const handleSqlChange = useCallback(
    (newSql: string) => {
      if (!output) return;
      updateToolOutput(toolCallId, {...output, sqlQuery: newSql});
    },
    [toolCallId, output, updateToolOutput],
  );

  if (!vegaLiteSpec) {
    return null;
  }

  return (
    <div className={cn('flex max-w-full flex-col gap-2', className)}>
      <VegaChartContainer
        spec={vegaLiteSpec}
        sqlQuery={sqlQuery}
        options={options}
        editable={editable}
        onSpecChange={handleSpecChange}
        onSqlChange={handleSqlChange}
      >
        <div className="relative max-w-full overflow-x-auto">
          <VegaChartDisplay aspectRatio={16 / 9} className="pt-2">
            <VegaLiteArrowChart.Actions className="right-3">
              <VegaExportAction />
              <VegaEditAction editorMode={editorMode} />
            </VegaLiteArrowChart.Actions>
          </VegaChartDisplay>
        </div>
      </VegaChartContainer>
    </div>
  );
}
