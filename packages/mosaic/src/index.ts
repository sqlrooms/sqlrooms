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
export {useMosaicDashboardContext} from './dashboard/MosaicDashboardContext';
export {DashboardPanelErrorBoundary} from './dashboard/DashboardPanelErrorBoundary';
export {createDefaultMosaicDashboardPanelRenderers} from './dashboard/defaultPanelRenderers';
export {defaultAddPanelActions} from './dashboard/defaultPanelActions';
export {useSelectedOrFirstTable} from './dashboard/useSelectedOrFirstTable';
export {useTablesWithColumns} from './dashboard/useTablesWithColumns';
export {MosaicDashboardPanelLayout} from './dashboard/MosaicDashboardPanelLayout';
export {
  MosaicDashboardInitialState,
  type MosaicDashboardInitialStateProps,
} from './dashboard/initial-state/MosaicDashboardInitialState';
export {addProfilerPanelAction} from './profiler/addProfilerPanelAction';
export {addTextPanelAction} from './text/addTextPanelAction';
export {addChartPanelAction} from './chart/addChartPanelAction';
export {
  createMosaicDashboardProfilerPanelConfig,
  createMosaicDashboardChartPanelConfig,
  createMosaicDashboardTextPanelConfig,
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
  MOSAIC_DASHBOARD_PROFILER_PANEL_TYPE,
  MOSAIC_DASHBOARD_CHART_PANEL_TYPE,
  MOSAIC_DASHBOARD_CHART_PANEL_TYPE as MOSAIC_DASHBOARD_VGPLOT_PANEL_TYPE,
  MOSAIC_DASHBOARD_TEXT_PANEL_TYPE,
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
  TextPanel,
} from './dashboard/dashboard-types';
export type {
  MosaicDashboardLayoutType,
  MosaicDashboardPanelSource,
  ProfilerPanelConfig,
  TextPanelConfig,
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
  MAX_DATA_POINTS,
  type CreateMosaicSliceProps,
  type MosaicClientOptions,
  type MosaicPreAggregateOptions,
  type MosaicSliceState,
  type TrackedClient,
} from './MosaicSlice';
export {DataPointLimitError} from './DataPointLimitError';
export {
  MosaicProfiler,
  type MosaicProfilerCompoundHeaderProps,
  type MosaicProfilerCompoundRowsProps,
  type MosaicProfilerCompoundStatusBarProps,
  type MosaicProfilerCompoundTableProps,
  type MosaicProfilerProps,
  type MosaicProfilerRootProps,
} from './profiler/MosaicProfiler';
export {
  MosaicProfilerHeader,
  type MosaicProfilerHeaderProps,
} from './profiler/MosaicProfilerHeader';
export {
  MosaicProfilerRows,
  type MosaicProfilerRowsProps,
} from './profiler/MosaicProfilerRows';
export {
  MosaicProfilerStatusBar,
  type MosaicProfilerStatusBarProps,
} from './profiler/MosaicProfilerStatusBar';
export {useMosaicProfiler} from './profiler/useMosaicProfiler';
export {
  ResponsivePlot,
  type PlotSize,
  type ResponsivePlotProps,
} from './ResponsivePlot';
export {useMosaicClient, type UseMosaicClientOptions} from './useMosaicClient';
export {VgPlotChart} from './VgPlotChart';
export {MAP_TOOL_KEY} from './ai';

// Compound components
export {MosaicChart} from './MosaicChart';
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
  getProfilerTableWidth,
  PROFILER_DEFAULT_COLUMN_WIDTH_PX,
  PROFILER_ROW_NUMBER_COLUMN_WIDTH_PX,
  PROFILER_UNSUPPORTED_COLUMN_WIDTH_PX,
} from './profiler/layout';
export type {
  MosaicProfilerCategoryBucket,
  MosaicProfilerCategorySummary,
  MosaicProfilerColumnKind,
  MosaicProfilerColumnState,
  MosaicProfilerHistogramSummary,
  MosaicProfilerOptions,
  MosaicProfilerPaginationState,
  MosaicProfilerSorting,
  MosaicProfilerSummaryState,
  UseMosaicProfilerReturn,
} from './profiler/types';

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
export {Field} from './chart-builders/Field';
export {TableSelector} from './chart-builders/TableSelector';
export {ColumnSelector} from './chart-builders/ColumnSelector';
export {MultiFieldSelector} from './chart-builders/MultiFieldSelector';
export {
  ColumnsProvider,
  useColumnsContext,
  type ColumnsContextValue,
} from './chart-builders/ColumnsContext';
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
  createProfilerTool,
  createTextPanelTool,
  createListPanelsTool,
  createRemovePanelTool,
  ProfilerToolParameters,
  TextPanelToolParameters,
  ListPanelsToolParameters,
  RemovePanelToolParameters,
} from './chart-types';
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
  ProfilerToolParams,
  TextPanelToolParams,
  ListPanelsToolParams,
  RemovePanelToolParams,
} from './chart-types';
export {
  buildChartTypeTitle,
  canCreateChartFromType,
  NUMERIC_COLUMN_TYPES,
  QUANTITATIVE_COLUMN_TYPES,
  TEMPORAL_COLUMN_TYPES,
} from './chart-builders/chartTypeUtils';
export type {FieldSelectorInputProps} from './chart-builders/FieldSelectorInput';
export type {
  ChartBuilderColumn,
  ChartBuilderDashboardPanelOutput,
  ChartBuilderField,
  ChartSpec,
  ChartTypeDefinition,
} from './chart-types/base-types';
export {MosaicCodeMirrorEditor} from './editor/MosaicCodeMirrorEditor';

// Dashboard agent
