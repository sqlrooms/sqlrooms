import {Dialog} from '@sqlrooms/ui';
import type {Spec} from '@uwdata/mosaic-spec';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  createChartBuilderTemplates,
  createDefaultChartBuilders,
} from './builders';
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
  onCreateChart: (
    spec: Spec,
    title: string,
    metadata?: {chartType?: string; settings?: Record<string, string>},
  ) => void;
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

  const resolvedOnOpenChange = useMemo(
    () => (isControlled ? (onOpenChange ?? (() => {})) : setUncontrolledOpen),
    [isControlled, onOpenChange],
  );

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
      const {selectedTemplateId, fieldValues} = store.getState();
      onCreateChart(spec, title, {
        chartType: selectedTemplateId,
        settings: fieldValues,
      });
      resolvedOnOpenChange(false);
    },
    [onCreateChart, resolvedOnOpenChange, store],
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
