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
export {
  createDefaultMosaicDashboardConfig,
  createMosaicDashboardChartConfig,
  createMosaicDashboardSlice,
  getMosaicDashboardDockId,
  getMosaicDashboardPanelId,
  MOSAIC_DASHBOARD_CHART_PANEL,
  MosaicDashboardChartConfig,
  MosaicDashboardEntry,
  MosaicDashboardSliceConfig,
  useStoreWithMosaicDashboard,
} from './dashboard/MosaicDashboardSlice';
export type {
  MosaicDashboardChartConfig as MosaicDashboardChartConfigType,
  MosaicDashboardEntry as MosaicDashboardEntryType,
  MosaicDashboardSliceConfig as MosaicDashboardSliceConfigType,
  MosaicDashboardSliceState,
  MosaicDashboardStoreState,
} from './dashboard/MosaicDashboardSlice';
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
  type MosaicSliceState,
  type TrackedClient,
} from './MosaicSlice';
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
export {useMosaicClient, type UseMosaicClientOptions} from './useMosaicClient';
export {
  ResponsivePlot,
  type PlotSize,
  type ResponsivePlotProps,
} from './ResponsivePlot';
export {VgPlotChart} from './VgPlotChart';

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

// Chart builder types and utilities
export {
  boxPlotBuilder,
  bubbleChartBuilder,
  countPlotBuilder,
  createChartBuilderTemplate,
  createChartBuilderTemplates,
  createDefaultChartBuilders,
  customSpecBuilder,
  ecdfBuilder,
  heatmapBuilder,
  histogramBuilder,
  lineChartBuilder,
  mosaicChartBuilders,
} from './chart-builders/builders';
export type {ChartBuilderActionsProps} from './chart-builders/ChartBuilderActions';
export type {ChartBuilderContentProps} from './chart-builders/ChartBuilderContent';
export {
  useChartBuilderContext,
  useChartBuilderStore,
} from './chart-builders/ChartBuilderContext';
export type {ChartBuilderContextValue} from './chart-builders/ChartBuilderContext';
export type {
  ChartBuilderDialogContentProps,
  ChartBuilderDialogProps,
  ChartBuilderRootProps,
  ChartBuilderTriggerProps,
} from './chart-builders/ChartBuilderDialog';
export type {ChartBuilderFieldsProps} from './chart-builders/ChartBuilderFields';
export type {ChartBuilderTypeGridProps} from './chart-builders/ChartBuilderTypeGrid';
export {buildChartTitleForSpec} from './chart-builders/chartSpecTitle';
export {
  boxPlotChartType,
  bubbleChartChartType,
  countPlotChartType,
  createDefaultChartTypes,
  customSpecChartType,
  ecdfChartType,
  heatmapChartType,
  histogramChartType,
  lineChartChartType,
  mosaicChartTypes,
} from './chart-builders/chartTypes';
export {
  buildChartTypeTitle,
  canCreateChartFromType,
  columnMatchesFieldTypes,
  getAvailableChartTypes,
  getCompatibleColumns,
  isChartTypeAvailable,
  NUMERIC_COLUMN_TYPES,
  QUANTITATIVE_COLUMN_TYPES,
  TEMPORAL_COLUMN_TYPES,
} from './chart-builders/chartTypeUtils';
export {
  describeChartSpecs,
  describeChartTypes,
} from './chart-builders/describeChartSpecs';
export type {FieldSelectorInputProps} from './chart-builders/FieldSelectorInput';
export {toChartSpec, toChartTypeDefinition} from './chart-builders/types';
export type {
  ChartBuilderColumn,
  ChartBuilderField,
  ChartBuilderTemplate,
  ChartSpec,
  ChartTypeDefinition,
} from './chart-builders/types';
export {MosaicCodeMirrorEditor} from './editor/MosaicCodeMirrorEditor';
