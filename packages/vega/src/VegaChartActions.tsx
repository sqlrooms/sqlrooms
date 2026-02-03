import {cn} from '@sqlrooms/ui';
import React from 'react';

export interface VegaChartActionsProps {
  /**
   * Action components to render in the toolbar
   */
  children: React.ReactNode;
  /**
   * Additional CSS classes for the container
   */
  className?: string;
}

/**
 * Container component for chart actions toolbar.
 * Positions actions as an overlay in the top-right corner of the chart.
 *
 * @example
 * ```tsx
 * <VegaLiteArrowChart spec={spec} arrowTable={data}>
 *   <VegaChartActions>
 *     <VegaExportAction />
 *     <Separator orientation="vertical" className="h-4" />
 *     <Button size="xs" variant="ghost" onClick={handleRefresh}>
 *       <RefreshCw className="h-4 w-4" />
 *     </Button>
 *   </VegaChartActions>
 * </VegaLiteArrowChart>
 * ```
 */
export const VegaChartActions: React.FC<VegaChartActionsProps> = ({
  children,
  className,
}) => {
  return (
    <div
      className={cn(
        'bg-background pointer-events-none absolute right-0 top-1 z-10 flex items-center gap-1 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100',
        className,
      )}
    >
      {children}
    </div>
  );
};
