import {Dialog} from '@sqlrooms/ui';
import React, {
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type {VgPlotChartConfig} from '../chart-types';
import {ChartBuilderContext} from './ChartBuilderContext';
import {createChartBuilderStore} from './createChartBuilderStore';
import type {
  ChartBuilderColumn,
  ChartTypeDefinition,
} from '../chart-types/base-types';

export type ChartBuilderRootProps = PropsWithChildren<{
  /** Table name to use in generated specs */
  tableName: string;
  /** Available columns for field selectors */
  columns: ChartBuilderColumn[];
  /** Callback when a chart spec is created */
  onCreateChart: (title: string, metadata: VgPlotChartConfig) => void;
  /** Optional chart types to show (defaults to all registered types) */
  chartTypes?: ChartTypeDefinition[];
  /** Controlled open state */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
}>;

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
  open,
  onOpenChange,
  children,
}) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [store] = useState(() => createChartBuilderStore());
  const isControlled = open !== undefined;
  const resolvedOpen = isControlled ? open : uncontrolledOpen;

  const resolvedOnOpenChange = useMemo(
    () => (isControlled ? (onOpenChange ?? (() => {})) : setUncontrolledOpen),
    [isControlled, onOpenChange],
  );

  // All resolved chart types are available by default
  // (Filtering by schema compatibility was removed in favour of runtime validation)
  const availableChartTypes = useMemo(() => chartTypes ?? [], [chartTypes]);

  useEffect(() => {
    const {selectedTemplateId, reset} = store.getState();
    if (
      selectedTemplateId &&
      !availableChartTypes.some(
        (template) => template.id === selectedTemplateId,
      )
    ) {
      reset();
    }
  }, [availableChartTypes, store]);

  const handleCreateChart: (title: string, config: VgPlotChartConfig) => void =
    useCallback(
      (title: string, config: VgPlotChartConfig) => {
        onCreateChart(title, config);
        resolvedOnOpenChange(false);
      },
      [onCreateChart, resolvedOnOpenChange],
    );

  const ctx = useMemo(
    () => ({
      tableName,
      columns,
      onCreateChart: handleCreateChart,
      templates: availableChartTypes,
      availableTemplates: availableChartTypes, // TODO: why we need both templates and availableTemplates? can we remove one of them?
      store,
    }),
    [availableChartTypes, columns, handleCreateChart, store, tableName],
  );

  return (
    <ChartBuilderContext.Provider value={ctx}>
      <Dialog open={resolvedOpen} onOpenChange={resolvedOnOpenChange}>
        {children}
      </Dialog>
    </ChartBuilderContext.Provider>
  );
};
