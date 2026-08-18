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
import type {VegaChartHeight, VegaChartHeightResolver} from './chartSizing';

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
  /**
   * Width-to-height ratio used when no fixed or automatic height is selected.
   * @default 16/9
   */
  aspectRatio?: number;
  /**
   * Fixed outer chart height, or `'auto'` to opt into category-aware sizing.
   * Automatic sizing falls back to the aspect ratio for ordinary charts.
   */
  height?: VegaChartHeight;
  /**
   * Optional application-specific height policy. Returning `'auto'` applies
   * the built-in category-aware sizing policy.
   */
  getHeight?: VegaChartHeightResolver;
};

/**
 * Renders a chart tool call with visualization using Vega-Lite.
 * Shows read-only editors for inspecting spec and SQL.
 */
export function VegaChartToolResult({
  className,
  input,
  output,
  options,
  editorMode = 'both',
  aspectRatio = 16 / 9,
  height,
  getHeight,
}: VegaChartToolResultProps): ReactNode {
  const sqlQuery = output?.sqlQuery ?? '';
  const vegaLiteSpec = output?.vegaLiteSpec as VisualizationSpec | null;

  if (!vegaLiteSpec) {
    return null;
  }

  return (
    <div className={cn('flex max-w-full flex-col gap-2', className)}>
      {input?.reasoning && (
        <p className="text-tiny text-muted-foreground">{input.reasoning}</p>
      )}
      <VegaChartContainer
        spec={vegaLiteSpec}
        sqlQuery={sqlQuery}
        options={options}
        editable={false}
      >
        <div className="relative max-w-full overflow-x-auto">
          <VegaChartDisplay
            aspectRatio={aspectRatio}
            height={height}
            getHeight={getHeight}
            className="pt-2"
          >
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
