import type {ToolRendererProps} from '@sqlrooms/ai-core';
import {cn} from '@sqlrooms/ui';
import {ReactNode} from 'react';
import {EmbedOptions, VisualizationSpec} from 'vega-embed';
import {EditorMode} from './editor/types';
import {VegaChartContainer} from './editor/VegaChartContainer';
import {VegaChartDisplay} from './editor/VegaChartDisplay';
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
   * Which editors to show when viewing
   * @default 'both'
   */
  editorMode?: EditorMode;
};

/**
 * Renders a chart tool call with visualization using Vega-Lite.
 * Shows read-only editors for inspecting spec and SQL.
 */
export function VegaChartToolResult({
  className,
  output,
  options,
  editorMode = 'both',
}: VegaChartToolResultProps): ReactNode {
  const sqlQuery = output?.sqlQuery ?? '';
  const vegaLiteSpec = output?.vegaLiteSpec as VisualizationSpec | null;

  if (!vegaLiteSpec) {
    return null;
  }

  return (
    <div className={cn('flex max-w-full flex-col gap-2', className)}>
      <VegaChartContainer
        spec={vegaLiteSpec}
        sqlQuery={sqlQuery}
        options={options}
        editable={false}
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
