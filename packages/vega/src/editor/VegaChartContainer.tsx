import * as arrow from 'apache-arrow';
import React from 'react';
import {EmbedOptions, VisualizationSpec} from 'vega-embed';
import {cn} from '@sqlrooms/ui';
import {VegaEditorContext} from './VegaEditorContext';
import {OnSpecChange, OnSqlChange, VegaEditorContextValue} from './types';
import {useVegaChartEditor} from './useVegaChartEditor';

export interface VegaChartContainerProps {
  /**
   * Initial Vega-Lite specification
   */
  spec: VisualizationSpec | string;
  /**
   * SQL query for data (alternative to arrowTable)
   */
  sqlQuery?: string;
  /**
   * Arrow table data (alternative to sqlQuery)
   */
  arrowTable?: arrow.Table;
  /**
   * Vega embed options
   */
  options?: EmbedOptions;
  /**
   * Whether editing is enabled
   * @default true
   */
  editable?: boolean;
  /**
   * Callback when spec changes are applied
   */
  onSpecChange?: OnSpecChange;
  /**
   * Callback when SQL query changes are applied
   */
  onSqlChange?: OnSqlChange;
  /**
   * Child components (Chart, SpecEditor, SqlEditor, Actions)
   */
  children: React.ReactNode;
  /**
   * Custom class name for the container
   */
  className?: string;
}

/**
 * Container component for composable Vega chart editing.
 * Provides context for child subcomponents.
 *
 * @example
 * ```tsx
 * <VegaLiteChart.Container
 *   spec={mySpec}
 *   sqlQuery={myQuery}
 *   editable={true}
 *   onSpecChange={(spec) => saveSpec(spec)}
 *   onSqlChange={(sql) => saveQuery(sql)}
 * >
 *   <VegaLiteChart.Chart />
 *   <VegaLiteChart.SpecEditor />
 *   <VegaLiteChart.SqlEditor />
 *   <VegaLiteChart.Actions />
 * </VegaLiteChart.Container>
 * ```
 */
export const VegaChartContainer: React.FC<VegaChartContainerProps> = ({
  spec,
  sqlQuery,
  arrowTable,
  options,
  editable = true,
  onSpecChange,
  onSqlChange,
  children,
  className,
}) => {
  // Use the editor hook internally
  const {state, actions, canApply, hasChanges} = useVegaChartEditor({
    initialSpec: spec,
    initialSql: sqlQuery,
    onSpecChange,
    onSqlChange,
  });

  // Build context value
  const contextValue: VegaEditorContextValue = {
    state,
    actions,
    editable,
    sqlQuery,
    arrowTable,
    options,
    canApply,
    hasChanges,
  };

  return (
    <VegaEditorContext.Provider value={contextValue}>
      <div className={cn('flex flex-col gap-2', className)}>{children}</div>
    </VegaEditorContext.Provider>
  );
};
