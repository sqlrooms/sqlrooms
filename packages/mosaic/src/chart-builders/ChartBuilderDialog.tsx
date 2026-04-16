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
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  createChartBuilderTemplates,
  createDefaultChartBuilders,
} from './builders';
import {ChartBuilderContent} from './ChartBuilderContent';
import {ChartBuilderContext} from './ChartBuilderContext';
import {createChartBuilderStore} from './createChartBuilderStore';
import {getAvailableChartTypes} from './chartTypeUtils';
import type {
  ChartBuilderColumn,
  ChartBuilderTemplate,
  ChartTypeDefinition,
} from './types';

export interface ChartBuilderRootProps {
  /** Table name to use in generated specs */
  tableName: string;
  /** Available columns for field selectors */
  columns: ChartBuilderColumn[];
  /** Callback when a chart spec is created */
  onCreateChart: (spec: Spec, title: string) => void;
  /** Preferred shared chart-type customization surface */
  chartTypes?: ChartTypeDefinition[];
  /** Backward-compatible UI template customization surface */
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
  chartTypes,
  builders,
  open,
  onOpenChange,
  children,
}) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [store] = useState(() => createChartBuilderStore());
  const isControlled = open !== undefined;
  const resolvedOpen = isControlled ? open : uncontrolledOpen;
  const resolvedOnOpenChange = isControlled
    ? (onOpenChange ?? (() => {}))
    : setUncontrolledOpen;

  const resolvedTemplates = useMemo(() => {
    if (chartTypes) {
      return createChartBuilderTemplates(chartTypes);
    }
    if (builders) {
      return builders;
    }
    return createDefaultChartBuilders();
  }, [builders, chartTypes]);

  const availableChartTypes = useMemo(
    () => getAvailableChartTypes(resolvedTemplates, columns),
    [columns, resolvedTemplates],
  );
  const availableTemplates = useMemo(
    () =>
      resolvedTemplates.filter((template) =>
        availableChartTypes.some((chartType) => chartType.id === template.id),
      ),
    [availableChartTypes, resolvedTemplates],
  );

  useEffect(() => {
    const {selectedTemplateId, reset} = store.getState();
    if (
      selectedTemplateId &&
      !availableTemplates.some((template) => template.id === selectedTemplateId)
    ) {
      reset();
    }
  }, [availableTemplates, store]);

  const handleCreateChart = useCallback(
    (spec: Spec, title: string) => {
      onCreateChart(spec, title);
      resolvedOnOpenChange(false);
    },
    [onCreateChart, resolvedOnOpenChange],
  );

  const ctx = useMemo(
    () => ({
      tableName,
      columns,
      onCreateChart: handleCreateChart,
      templates: resolvedTemplates,
      availableChartTypes,
      availableTemplates,
      store,
    }),
    [
      availableChartTypes,
      availableTemplates,
      columns,
      handleCreateChart,
      resolvedTemplates,
      store,
      tableName,
    ],
  );

  return (
    <ChartBuilderContext.Provider value={ctx}>
      <Dialog open={resolvedOpen} onOpenChange={resolvedOnOpenChange}>
        {children}
      </Dialog>
    </ChartBuilderContext.Provider>
  );
};

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

export interface ChartBuilderDialogContentProps {
  /** Override dialog title (default "Add Chart") */
  title?: string;
  /** Override dialog description */
  description?: string;
  className?: string;
  children?: React.ReactNode;
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
  onCreateChart: (spec: Spec, title: string) => void;
  /** Preferred shared chart-type customization surface */
  chartTypes?: ChartTypeDefinition[];
  /** Backward-compatible UI template customization surface */
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
  chartTypes,
  builders,
}) => (
  <ChartBuilderRoot
    open={open}
    onOpenChange={onOpenChange}
    tableName={tableName}
    columns={columns}
    onCreateChart={onCreateChart}
    chartTypes={chartTypes}
    builders={builders}
  >
    <ChartBuilderDialogContent />
  </ChartBuilderRoot>
);
