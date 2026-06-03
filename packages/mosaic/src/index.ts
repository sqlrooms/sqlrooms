/**
 * {@include ../README.md}
 * @packageDocumentation
 */
export {
  isParam,
  isSelection,
  makeClient,
  Param,
  Selection,
} from '@uwdata/mosaic-core';
export {astToDOM, astToESM, parseSpec} from '@uwdata/mosaic-spec';
export type {Spec} from '@uwdata/mosaic-spec';
export {asc, column, desc, Query, sql} from '@uwdata/mosaic-sql';
export * as vg from '@uwdata/vgplot';
export {
  MosaicDashboard,
  MosaicDashboardRoot,
  type MosaicDashboardProps,
  type MosaicDashboardRootProps,
} from './dashboard/MosaicDashboard';
export {
  createMosaicDashboardBlockDefinition,
  type CreateMosaicDashboardBlockDefinitionOptions,
  type MosaicDashboardBlockRenderProps,
} from './dashboard/createMosaicDashboardBlockDefinition';
export {DefaultMosaicDashboardBlock} from './dashboard/DefaultMosaicDashboardBlock';
export {useMosaicDashboardContext} from './dashboard/MosaicDashboardContext';
export {MosaicDashboardPanelErrorBoundary} from './dashboard/panel/MosaicDashboardPanelErrorBoundary';
export {createDefaultMosaicDashboardPanelRenderers} from './dashboard/createDefaultMosaicDashboardPanelRenderers';
export {defaultAddPanelActions} from './dashboard/defaultPanelActions';
export {useSelectedOrFirstTable} from './dashboard/useSelectedOrFirstTable';
export {useTablesWithColumns} from './hooks/useTablesWithColumns';
export {MosaicDashboardPanelLayout} from './dashboard/panel/MosaicDashboardPanelLayout';
export {
  MosaicDashboardInitialState,
  type MosaicDashboardInitialStateProps,
} from './dashboard/initial-state/MosaicDashboardInitialState';
export {addDataTableExplorerPanelAction} from './data-table-explorer/addDataTableExplorerPanelAction';
export {addChartPanelAction} from './charts/addChartPanelAction';
export {
  createMosaicDashboardDataTableExplorerPanelConfig,
  createMosaicDashboardChartPanelConfig,
  createDefaultMosaicDashboardConfig,
  createMosaicDashboardSlice,
  getMosaicDashboardDockId,
  getMosaicDashboardGridId,
  getMosaicDashboardPanelId,
  getMosaicDashboardSelectionName,
  isChartPanelConfig,
  MOSAIC_DASHBOARD_PANEL,
  MosaicDashboardSliceConfig,
  useStoreWithMosaicDashboard,
} from './dashboard/MosaicDashboardSlice';
export {
  MOSAIC_DASHBOARD_DATA_TABLE_EXPLORER_PANEL_TYPE,
  MOSAIC_DASHBOARD_CHART_PANEL_TYPE,
  MOSAIC_DASHBOARD_CHART_PANEL_TYPE as MOSAIC_DASHBOARD_VGPLOT_PANEL_TYPE,
  MosaicDashboardEntry,
  MosaicDashboardPanelConfig,
} from './dashboard/dashboard-types';
export type {
  MosaicDashboardAddPanelAction,
  MosaicDashboardAddPanelActionContext,
  OnStartDashboard,
} from './dashboard/action-types';
export type {
  CreateMosaicDashboardSliceProps,
  MosaicDashboardPanelRenderer,
  MosaicDashboardPanelRendererProps,
  MosaicDashboardSliceConfig as MosaicDashboardSliceConfigType,
  MosaicDashboardSliceState,
  MosaicDashboardStoreState,
} from './dashboard/MosaicDashboardSlice';
export type {
  MosaicDashboardEntry as MosaicDashboardEntryType,
  MosaicDashboardPanelConfig as MosaicDashboardPanelConfigType,
  ChartPanelConfig,
} from './dashboard/dashboard-types';
export type {
  MosaicDashboardLayoutType,
  MosaicDashboardPanelSource,
  DataTableExplorerPanelConfig,
} from './dashboard/core-types';
export {
  createMosaicColorLegendPlot,
  MosaicColorLegend,
  type MosaicColorLegendProps,
} from './MosaicColorLegend';
export {
  createDefaultMosaicConfig,
  createMosaicSlice,
  MosaicSliceConfig,
  type CreateMosaicSliceProps,
  type MosaicClientOptions,
  type MosaicPreAggregateOptions,
  type MosaicSliceState,
  type TrackedClient,
} from './MosaicSlice';
export {DataPointLimitError} from './DataPointLimitError';
export {
  MosaicChartView,
  type MosaicChartViewProps,
} from './charts/MosaicChartView';
export {
  MosaicChartSettingsPanel,
  type MosaicChartSettingsPanelProps,
} from './charts/MosaicChartSettingsPanel';
export {useBrushSelectionParams} from './charts/useBrushSelectionParams';
export {
  useChartRetainer,
  useChartRetainerByKey,
} from './charts/useChartRetainer';
export {
  DEFAULT_CHART_MAX_DATA_POINTS,
  assertChartDataPolicy,
  createChartRuntimeIssueFromError,
  getQueryResultRowCount,
  resolveChartDataPolicy,
  type ChartDataPolicy,
  type ChartDataPolicyOverride,
  type ChartDataPolicyContext,
  type ChartRuntimeIssue,
  type ChartRuntimeIssueContext,
  type ChartRuntimeIssueReporter,
} from './chart-runtime';
export {
  DataTableExplorer,
  type DataTableExplorerCompoundHeaderProps,
  type DataTableExplorerCompoundResetButtonProps,
  type DataTableExplorerCompoundRowsProps,
  type DataTableExplorerCompoundStatusBarProps,
  type DataTableExplorerCompoundTableProps,
  type DataTableExplorerProps,
  type DataTableExplorerRootProps,
} from './data-table-explorer/DataTableExplorer';
export {DataTableBlockRenderer} from './data-table-explorer/worksheet/DataTableBlockRenderer';
export {
  DataTableExplorerHeader,
  type DataTableExplorerHeaderProps,
} from './data-table-explorer/DataTableExplorerHeader';
export {
  DataTableExplorerRows,
  type DataTableExplorerRowsProps,
} from './data-table-explorer/DataTableExplorerRows';
export {
  DataTableExplorerStatusBar,
  type DataTableExplorerStatusBarProps,
} from './data-table-explorer/DataTableExplorerStatusBar';
export {useDataTableExplorer} from './data-table-explorer/useDataTableExplorer';
export {
  ResponsivePlot,
  type PlotSize,
  type ResponsivePlotProps,
} from './ResponsivePlot';
export {useMosaicClient, type UseMosaicClientOptions} from './useMosaicClient';
export {VgPlotChart} from './VgPlotChart';
export {
  DASHBOARD_AI_INSTRUCTIONS,
  MAP_TOOL_KEY,
  createDashboardAgentTool,
  createDashboardAiTools,
} from './ai/ai';
export type {
  CreateDashboardAgentToolOptions,
  CreateDashboardAiToolsOptions,
  DashboardAgentResult,
  DashboardAgentRunResult,
  DashboardAgentToolCall,
  DashboardAiAdapter,
  DashboardAiStore,
  DashboardAiTable,
  CreateDashboardToolDepsOptions,
} from './ai/ai';

// Compound components
export {MosaicSpecChart} from './MosaicChart';
export {MosaicChartBuilder} from './MosaicChartBuilder';

// Editor hooks and context
export {useMosaicEditorContext} from './editor/MosaicEditorContext';
export {
  getCachedMosaicSchema,
  loadMosaicSchema,
  preloadMosaicSchema,
} from './editor/mosaicSchema';
export {useMosaicChartEditor} from './editor/useMosaicChartEditor';

// Editor types
export type {MosaicChartContainerProps} from './editor/MosaicChartContainer';
export type {MosaicChartDisplayProps} from './editor/MosaicChartDisplay';
export type {MosaicChartEditorActionsProps} from './editor/MosaicChartEditorActions';
export type {MosaicCodeMirrorEditorProps} from './editor/MosaicCodeMirrorEditor';
export type {MosaicSpecEditorPanelProps} from './editor/MosaicSpecEditorPanel';
export type {
  MosaicEditorActions,
  MosaicEditorContextValue,
  MosaicEditorState,
  OnMosaicSpecChange,
  UseMosaicChartEditorOptions,
  UseMosaicChartEditorReturn,
} from './editor/types';
export {
  getDataTableExplorerTableWidth,
  DATA_TABLE_EXPLORER_DEFAULT_COLUMN_WIDTH_PX,
  DATA_TABLE_EXPLORER_ROW_NUMBER_COLUMN_WIDTH_PX,
  DATA_TABLE_EXPLORER_UNSUPPORTED_COLUMN_WIDTH_PX,
} from './data-table-explorer/layout';
export type {
  DataTableExplorerCategoryBucket,
  DataTableExplorerCategorySummary,
  DataTableExplorerColumnKind,
  DataTableExplorerColumnState,
  DataTableExplorerHistogramSummary,
  DataTableExplorerOptions,
  DataTableExplorerPaginationState,
  DataTableExplorerSorting,
  DataTableExplorerSummaryState,
  UseDataTableExplorerReturn,
} from './data-table-explorer/types';

// Chart builder components
export type {ChartBuilderActionsProps} from './chart-builders/ChartBuilderActions';
export {ChartBuilderActions} from './chart-builders/ChartBuilderActions';
export type {ChartBuilderContentProps} from './chart-builders/ChartBuilderContent';
export {ChartBuilderContent} from './chart-builders/ChartBuilderContent';
export {
  useChartBuilderContext,
  useChartBuilderStore,
} from './chart-builders/ChartBuilderContext';
export type {ChartBuilderContextValue} from './chart-builders/ChartBuilderContext';
export type {
  ChartBuilderDialogContentProps,
  ChartBuilderDialogProps,
  ChartBuilderTriggerProps,
} from './chart-builders/ChartBuilderDialog';
export {
  ChartBuilderDialogContent,
  ChartBuilderTrigger,
} from './chart-builders/ChartBuilderDialog';
export type {ChartBuilderRootProps} from './chart-builders/ChartBuilderRoot';
export {ChartBuilderRoot} from './chart-builders/ChartBuilderRoot';
export type {ChartBuilderFieldsProps} from './chart-builders/ChartBuilderFields';
export {ChartBuilderFields} from './chart-builders/ChartBuilderFields';
export {Field} from './components/Field';
export {TableSelector} from './components/TableSelector';
export {ColumnSelector} from './components/ColumnSelector';
export {MultiFieldSelector} from './components/MultiFieldSelector';
export {
  ColumnsProvider,
  useColumnsContext,
  type ColumnsContextValue,
} from './components/ColumnsContext';
export type {ChartBuilderTypeGridProps} from './chart-builders/ChartBuilderTypeGrid';
export {ChartBuilderTypeGrid} from './chart-builders/ChartBuilderTypeGrid';
export {buildChartTitleForSpec} from './chart-builders/chartSpecTitle';
export {
  boxPlotChartType,
  bubbleChartChartType,
  countPlotChartType,
  createDefaultChartTypes,
  customSpecChartType,
  heatmapChartType,
  histogramChartType,
  isSpecChartType,
  isComponentChartType,
  lineChartChartType,
  mosaicChartTypes,
  ChartConfig,
  HistogramChartSettings,
  LineChartSettings,
  CountPlotChartSettings,
  BubbleChartSettings,
  HeatmapChartSettings,
  BoxPlotChartSettings,
  // Tool helpers, parameters, and AI tool creators
  BaseChartToolParameters,
  validateColumnExists,
  HistogramToolParameters,
  LineChartToolParameters,
  CountPlotToolParameters,
  HeatmapToolParameters,
  BubbleChartToolParameters,
  BoxPlotToolParameters,
  createHistogramAiTool,
  createLineChartAiTool,
  createCountPlotAiTool,
  createHeatmapAiTool,
  createBubbleChartAiTool,
  createBoxPlotAiTool,
  createChartTools,
  // New panel and dashboard tools
  createDataTableExplorerTool,
  createListPanelsTool,
  createRemovePanelTool,
  DataTableExplorerToolParameters,
  ListPanelsToolParameters,
  RemovePanelToolParameters,
} from './charts/chart-types';
export type {
  ChartSettings,
  ChartType,
  ChartToolExecutionContext,
  DashboardToolDeps,
  ResolvedChartResources,
  CreateChartParams,
  CreateChartResult,
  HistogramToolParams,
  LineChartToolParams,
  CountPlotToolParams,
  HeatmapToolParams,
  BubbleChartToolParams,
  BoxPlotToolParams,
  DataTableExplorerToolParams,
  ListPanelsToolParams,
  RemovePanelToolParams,
} from './charts/chart-types';
export {
  buildChartTypeTitle,
  canCreateChartFromType,
} from './chart-builders/chartTypeUtils';
export {
  NUMERIC_COLUMN_TYPES,
  QUANTITATIVE_COLUMN_TYPES,
  TEMPORAL_COLUMN_TYPES,
} from './column-types-utils';
export type {FieldSelectorInputProps} from './components/FieldSelectorInput';
export type {
  ChartBuilderColumn,
  ChartBuilderDashboardPanelOutput,
  ChartBuilderField,
  ChartSpec,
  ChartTypeDefinition,
} from './charts/chart-types/base-types';
export {MosaicCodeMirrorEditor} from './editor/MosaicCodeMirrorEditor';

// Dashboard agent

export {MosaicChart} from './charts/MosaicChart';
export {useParseChartConfig} from './charts/useParseChartConfig';
export {ChartBlockRenderer} from './charts/worksheet/ChartBlockRenderer';
export {useDataTable} from './hooks/useDataTable';
