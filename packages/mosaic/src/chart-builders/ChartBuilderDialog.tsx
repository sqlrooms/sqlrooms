import {
  Button,
  type ButtonProps,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@sqlrooms/ui';
import type {Spec} from '@uwdata/mosaic-spec';
import {Plus} from 'lucide-react';
import React, {useCallback, useMemo, useState} from 'react';
import {ChartBuilderContent} from './ChartBuilderContent';
import {
  ChartBuilderContext,
  useChartBuilderContext,
} from './ChartBuilderContext';
import type {ChartBuilderColumn, ChartBuilderTemplate} from './types';

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

export interface ChartBuilderRootProps {
  /** Table name to use in generated specs */
  tableName: string;
  /** Available columns for field selectors */
  columns: ChartBuilderColumn[];
  /** Callback when a chart spec is created */
  onCreateChart: (spec: Spec, title: string) => void;
  /** Custom builders (defaults to all built-in builders) */
  builders?: ChartBuilderTemplate[];
  /** Controlled open state */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

/**
 * Compound-component root that provides shared chart-builder state via context
 * and renders a Radix `Dialog`.
 *
 * Supports both controlled (`open`/`onOpenChange`) and uncontrolled usage.
 */
export const ChartBuilderRoot: React.FC<ChartBuilderRootProps> = ({
  tableName,
  columns,
  onCreateChart,
  builders,
  open,
  onOpenChange,
  children,
}) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = open !== undefined;
  const resolvedOpen = isControlled ? open : uncontrolledOpen;
  const resolvedOnOpenChange = isControlled
    ? (onOpenChange ?? (() => {}))
    : setUncontrolledOpen;

  const handleCreateChart = useCallback(
    (spec: Spec, title: string) => {
      onCreateChart(spec, title);
      resolvedOnOpenChange(false);
    },
    [onCreateChart, resolvedOnOpenChange],
  );

  const ctx = useMemo(
    () => ({tableName, columns, onCreateChart: handleCreateChart, builders}),
    [tableName, columns, handleCreateChart, builders],
  );

  return (
    <ChartBuilderContext.Provider value={ctx}>
      <Dialog open={resolvedOpen} onOpenChange={resolvedOnOpenChange}>
        {children}
      </Dialog>
    </ChartBuilderContext.Provider>
  );
};

// ---------------------------------------------------------------------------
// Trigger
// ---------------------------------------------------------------------------

export type ChartBuilderTriggerProps = ButtonProps;

/**
 * Default trigger button that opens the chart-builder dialog.
 *
 * Renders inside a Radix `DialogTrigger`, so it automatically toggles the
 * dialog. All `ButtonProps` are forwarded, allowing full customization of
 * variant, size, className, children, etc.
 */
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

// ---------------------------------------------------------------------------
// Dialog (content pane)
// ---------------------------------------------------------------------------

export interface ChartBuilderDialogContentProps {
  /** Override dialog title (default "Add Chart") */
  title?: string;
  /** Override dialog description */
  description?: string;
  className?: string;
}

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
}) => {
  const {tableName, columns, onCreateChart, builders} =
    useChartBuilderContext();

  return (
    <DialogContent className={className ?? 'sm:max-w-lg'}>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <ChartBuilderContent
        tableName={tableName}
        columns={columns}
        onCreateChart={onCreateChart}
        builders={builders}
      />
    </DialogContent>
  );
};

// ---------------------------------------------------------------------------
// Legacy one-shot component (kept for backward compatibility)
// ---------------------------------------------------------------------------

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
  onCreateChart: (spec: Spec, title: string) => void;
  /** Custom builders (defaults to all built-in builders) */
  builders?: ChartBuilderTemplate[];
}

/**
 * Dialog wrapper for the chart builder (legacy API).
 *
 * Prefer the compound form:
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
  builders,
}) => (
  <ChartBuilderRoot
    open={open}
    onOpenChange={onOpenChange}
    tableName={tableName}
    columns={columns}
    onCreateChart={onCreateChart}
    builders={builders}
  >
    <ChartBuilderDialogContent />
  </ChartBuilderRoot>
);
