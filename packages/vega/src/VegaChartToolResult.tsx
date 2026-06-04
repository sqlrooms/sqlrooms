import type {ToolRendererProps} from '@sqlrooms/ai-core';
import {
  cn,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@sqlrooms/ui';
import {SquareDashedMousePointer} from 'lucide-react';
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
import {
  VegaLiteArrowChart,
  VegaBrushSelectionRanges,
} from './VegaLiteArrowChart';

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
   * Callback for brush selection events (opt-in).
   * When provided, an interval selection param is injected into the spec.
   */
  onBrushSelection?: (ranges: VegaBrushSelectionRanges) => void;
  /**
   * When true, shows an indicator that brush-to-map highlighting is available.
   * When explicitly false, shows a muted indicator that brush is not available.
   * When undefined (default), no indicator is shown.
   */
  brushAvailable?: boolean;
};

/**
 * Renders a chart tool call with visualization using Vega-Lite.
 * Shows read-only editors for inspecting spec and SQL.
 *
 * When `onBrushSelection` is provided, an interval selection param is
 * injected into the Vega-Lite spec and the callback is invoked on brush
 * events. The caller is responsible for deciding whether to act on the
 * ranges (e.g. by computing a brush field mapping from the SQL query).
 */
export function VegaChartToolResult({
  className,
  input,
  output,
  options,
  editorMode = 'both',
  onBrushSelection,
  brushAvailable,
}: VegaChartToolResultProps): ReactNode {
  const sqlQuery = output?.sqlQuery ?? '';
  const vegaLiteSpec = output?.vegaLiteSpec as VisualizationSpec | null;

  if (!vegaLiteSpec) {
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
        spec={vegaLiteSpec}
        sqlQuery={sqlQuery}
        options={options}
        editable={false}
        onBrushSelection={onBrushSelection}
      >
        <div className="relative max-w-full overflow-x-auto">
          <VegaChartDisplay aspectRatio={16 / 9} className="pt-2">
            <VegaLiteArrowChart.Actions className="right-3">
              {brushAvailable !== undefined && (
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          'flex h-6 w-6 items-center justify-center rounded-sm',
                          brushAvailable
                            ? 'text-primary'
                            : 'text-muted-foreground/40',
                        )}
                        aria-label={
                          brushAvailable
                            ? 'Brush to highlight map layers'
                            : 'No map layer linked'
                        }
                      >
                        <SquareDashedMousePointer className="h-3.5 w-3.5" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      {brushAvailable
                        ? 'Brush to highlight map layers'
                        : 'No map layer linked'}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <VegaExportAction />
              <VegaEditAction editorMode={editorMode} />
            </VegaLiteArrowChart.Actions>
          </VegaChartDisplay>
        </div>
      </VegaChartContainer>
    </div>
  );
}
