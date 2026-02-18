/**
 * {@include ../README.md}
 * @packageDocumentation
 */

import {VegaLiteSqlChart} from './VegaLiteSqlChart';
import {VegaLiteArrowChart} from './VegaLiteArrowChart';
import {VegaChartContainer} from './editor/VegaChartContainer';
import {VegaChartDisplay} from './editor/VegaChartDisplay';
import {VegaSpecEditorPanel} from './editor/VegaSpecEditorPanel';
import {VegaSqlEditorPanel} from './editor/VegaSqlEditorPanel';
import {VegaChartEditorActions} from './editor/VegaChartEditorActions';

export {VegaChartToolResult as VegaChartToolResult} from './VegaChartToolResult';
export type {VisualizationSpec} from 'vega-embed';
export {
  createVegaChartTool,
  VegaChartToolParameters,
  DEFAULT_VEGA_CHART_DESCRIPTION,
} from './VegaChartTool';

export type {
  VegaChartToolParameters as VegaChartToolParametersType,
  VegaChartToolOptions,
} from './VegaChartTool';

/**
 * Composable Vega-Lite chart component with editing capabilities.
 *
 * @example
 * ```tsx
 * // Compound component pattern
 * <VegaLiteChart.Container
 *   spec={mySpec}
 *   sqlQuery={myQuery}
 *   editable={true}
 *   onSpecChange={(spec) => saveSpec(spec)}
 * >
 *   <VegaLiteChart.Chart />
 *   <VegaLiteChart.SpecEditor />
 *   <VegaLiteChart.SqlEditor />
 *   <VegaLiteChart.Actions />
 * </VegaLiteChart.Container>
 *
 * // Simple usage (legacy)
 * <VegaLiteChart spec={mySpec} sqlQuery={myQuery} />
 * ```
 */
export const VegaLiteChart = Object.assign(VegaLiteSqlChart, {
  // Legacy chart components
  SqlChart: VegaLiteSqlChart,
  ArrowChart: VegaLiteArrowChart,
  // Compound editor components
  Container: VegaChartContainer,
  Chart: VegaChartDisplay,
  SpecEditor: VegaSpecEditorPanel,
  SqlEditor: VegaSqlEditorPanel,
  Actions: VegaChartEditorActions,
});

// Export editor components and hooks for advanced use
export {VegaMonacoEditor} from './editor/VegaMonacoEditor';
export {useVegaChartEditor} from './editor/useVegaChartEditor';
export {useVegaEditorContext} from './editor/VegaEditorContext';

// Export editor types
export type {
  EditorMode,
  OnSpecChange,
  OnSqlChange,
  UseVegaChartEditorOptions,
  UseVegaChartEditorReturn,
  VegaEditorActions,
  VegaEditorContextValue,
  VegaEditorState,
} from './editor/types';

// Export schema utilities
export {
  loadVegaLiteSchema,
  getCachedVegaLiteSchema,
  preloadVegaLiteSchema,
} from './schema/vegaLiteSchema';

// Export chart context and hook for custom actions
export {useVegaChartContext} from './VegaChartContext';
export type {VegaChartContextValue} from './VegaChartContext';

// Export action components
export {VegaExportAction} from './VegaExportAction';
export type {VegaExportActionProps} from './VegaExportAction';
export {VegaEditAction} from './VegaEditAction';
export type {VegaEditActionProps} from './VegaEditAction';
export {VegaChartActions} from './VegaChartActions';
export type {VegaChartActionsProps} from './VegaChartActions';
