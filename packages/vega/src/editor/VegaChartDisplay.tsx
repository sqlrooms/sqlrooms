import {useSql} from '@sqlrooms/duckdb';
import {cn} from '@sqlrooms/ui';
import {AlertCircle} from 'lucide-react';
import React from 'react';
import {VegaLiteArrowChart} from '../VegaLiteArrowChart';
import {useVegaEditorContext} from './VegaEditorContext';

export interface VegaChartDisplayProps {
  /**
   * Custom class name for the chart container
   */
  className?: string;
  /**
   * Aspect ratio for the chart
   * @default 16/9
   */
  aspectRatio?: number;
}

/**
 * Chart display subcomponent for VegaLiteChart.Container.
 * Renders the Vega-Lite chart with data from SQL query or arrow table.
 *
 * Uses the parsed spec from the editor state for live preview during editing.
 *
 * Must be used within a VegaLiteChart.Container component.
 *
 * @example
 * ```tsx
 * <VegaLiteChart.Container spec={spec} sqlQuery={query}>
 *   <VegaLiteChart.Chart />
 * </VegaLiteChart.Container>
 * ```
 */
export const VegaChartDisplay: React.FC<VegaChartDisplayProps> = ({
  className,
  aspectRatio = 16 / 9,
}) => {
  const {state, arrowTable, options} = useVegaEditorContext();

  // Use the applied SQL for chart rendering (updates when Apply is clicked)
  const sqlQuery = state.appliedSql;

  // Fetch data from SQL if no arrowTable provided
  const sqlResult = useSql({
    query: sqlQuery || '',
    enabled: !!sqlQuery && !arrowTable,
  });

  // Use arrow table if provided, otherwise use SQL result
  const chartData = arrowTable ?? sqlResult.data?.arrowTable;

  // Use parsed spec for live preview, fall back to string if parse failed
  const spec = state.parsedSpec ?? state.editedSpecString;

  // Show loading state
  if (sqlQuery && !arrowTable && sqlResult.isLoading) {
    return (
      <div
        className={cn(
          'text-muted-foreground flex items-center justify-center',
          className,
        )}
      >
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
        <span className="ml-2 text-sm">Loading data...</span>
      </div>
    );
  }

  // Show error state
  if (sqlQuery && !arrowTable && sqlResult.error) {
    return (
      <div
        className={cn(
          'flex items-center justify-center text-red-500',
          className,
        )}
      >
        <span className="text-sm">Error: {sqlResult.error.message}</span>
      </div>
    );
  }

  return (
    <div className={cn('relative', className)}>
      <VegaLiteArrowChart
        className="w-full"
        spec={spec}
        arrowTable={chartData}
        aspectRatio={aspectRatio}
        options={options}
      />
      {/* Spec parse error overlay */}
      {state.specParseError && (
        <div className="absolute inset-x-0 bottom-0 bg-red-500/90 px-3 py-2 text-white backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span className="truncate text-xs">{state.specParseError}</span>
          </div>
        </div>
      )}
    </div>
  );
};
