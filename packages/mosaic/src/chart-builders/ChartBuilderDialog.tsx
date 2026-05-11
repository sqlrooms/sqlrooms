import {
  Button,
  type ButtonProps,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@sqlrooms/ui';
import {Plus} from 'lucide-react';
import React, {PropsWithChildren} from 'react';
import type {VgPlotChartConfig} from '../chart-types';
import {ChartBuilderContent} from './ChartBuilderContent';
import {ChartBuilderRoot} from './ChartBuilderRoot';
import type {
  ChartBuilderColumn,
  ChartTypeDefinition,
} from '../chart-types/base-types';

export type ChartBuilderTriggerProps = ButtonProps;

export const ChartBuilderTrigger = React.forwardRef<
  HTMLButtonElement,
  ChartBuilderTriggerProps
>(({children, ...props}, ref) => {
  return (
    <DialogTrigger asChild>
      <Button ref={ref} variant="outline" size="sm" {...props}>
        {children ?? (
          <>
            <Plus className="mr-1 h-4 w-4" />
            Add Chart
          </>
        )}
      </Button>
    </DialogTrigger>
  );
});
ChartBuilderTrigger.displayName = 'ChartBuilderTrigger';

export type ChartBuilderDialogContentProps = PropsWithChildren<{
  /** Override dialog title (default "Add Chart") */
  title?: string;
  /** Override dialog description */
  description?: string;
  className?: string;
}>;

/**
 * The dialog content pane that renders the chart-builder steps.
 * Must be rendered inside `<MosaicChartBuilder>`.
 */
export const ChartBuilderDialogContent: React.FC<
  ChartBuilderDialogContentProps
> = ({
  title = 'Add Chart',
  description = 'Select a chart type to create.',
  className,
  children,
}) => {
  return (
    <DialogContent className={className ?? 'sm:max-w-lg'}>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      {children ?? <ChartBuilderContent />}
    </DialogContent>
  );
};

export interface ChartBuilderDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** Table name to use in generated specs */
  tableName: string;
  /** Available columns for field selectors */
  columns: ChartBuilderColumn[];
  /** Callback when a chart spec is created */
  onCreateChart: (title: string, config: VgPlotChartConfig) => void;
  /** Optional chart types to show (defaults to all registered types) */
  chartTypes?: ChartTypeDefinition[];
}

/**
 * Dialog wrapper for the chart builder (legacy API).
 *
 * @deprecated Prefer the compound form:
 * ```tsx
 * <MosaicChartBuilder tableName={…} columns={…} onCreateChart={…}>
 *   <MosaicChartBuilder.Trigger />
 *   <MosaicChartBuilder.Dialog />
 * </MosaicChartBuilder>
 * ```
 */
export const ChartBuilderDialog: React.FC<ChartBuilderDialogProps> = ({
  open,
  onOpenChange,
  tableName,
  columns,
  onCreateChart,
  chartTypes,
}) => (
  <ChartBuilderRoot
    open={open}
    onOpenChange={onOpenChange}
    tableName={tableName}
    columns={columns}
    onCreateChart={onCreateChart}
    chartTypes={chartTypes}
  >
    <ChartBuilderDialogContent />
  </ChartBuilderRoot>
);
