/**
 * {@include ../README.md}
 * @packageDocumentation
 */

// ============================================================================
// Mosaic Core (UW Data Lab) - Base primitives
// ============================================================================

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

// ============================================================================
// Core Mosaic State Management
// ============================================================================

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
export {useMosaicClient, type UseMosaicClientOptions} from './useMosaicClient';

// ============================================================================
// Dashboard Components & Configuration
// ============================================================================

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
export {MosaicDashboardPanelLayout} from './dashboard/panel/MosaicDashboardPanelLayout';
export {createDefaultMosaicDashboardPanelRenderers} from './dashboard/createDefaultMosaicDashboardPanelRenderers';
export {defaultAddPanelActions} from './dashboard/defaultPanelActions';
export {
  DataTableSelector,
  DataTableSelectorEmptyState,
  type DataTableSelectorProps,
} from './components/DataTableSelector';

// Dashboard hooks
export {useSelectedOrFirstTable} from './dashboard/useSelectedOrFirstTable';
export {useTablesWithColumns} from './hooks/useTablesWithColumns';
export {usePanelClientRegistration} from './dashboard/usePanelClientRegistration';
export {usePanelClients} from './dashboard/usePanelClients';
export {
  usePanelResetFilters,
  type UsePanelResetFiltersOptions,
  type UsePanelResetFiltersReturn,
} from './dashboard/hooks/usePanelResetFilters';
export {
  useDashboardResetFilters,
  type UseDashboardResetFiltersOptions,
  type UseDashboardResetFiltersReturn,
} from './dashboard/hooks/useDashboardResetFilters';
export {
  ResetFiltersButton,
  type ResetFiltersButtonProps,
} from './dashboard/components/ResetFiltersButton';

// Dashboard panel actions
export {addDataTableExplorerPanelAction} from './data-table-explorer/addDataTableExplorerPanelAction';
export {addChartPanelAction} from './charts/addChartPanelAction';

// Dashboard state slice
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
// Dashboard types and constants
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

// ============================================================================
// Charts & Visualizations
// ============================================================================

export {
  MosaicChartView,
  type MosaicChartViewProps,
} from './charts/MosaicChartView';
export {MosaicChart} from './charts/MosaicChart';
export {MosaicSpecChart} from './MosaicChart';
export {VgPlotChart} from './VgPlotChart';
export {
  MosaicChartSettingsPanel,
  type MosaicChartSettingsPanelProps,
} from './charts/MosaicChartSettingsPanel';
export {
  createMosaicColorLegendPlot,
  MosaicColorLegend,
  type MosaicColorLegendProps,
} from './MosaicColorLegend';
export {
  ResponsivePlot,
  type PlotSize,
  type ResponsivePlotProps,
} from './ResponsivePlot';

// Chart hooks
export {useBrushSelectionParams} from './charts/useBrushSelectionParams';
export {
  useChartRetainer,
  useChartRetainerByKey,
} from './charts/useChartRetainer';
export {useParseChartConfig} from './charts/useParseChartConfig';

// Chart runtime and data policies
export {DataPointLimitError} from './DataPointLimitError';
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

// ============================================================================
// Data Table Explorer
// ============================================================================

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
  DataTableExplorerTableReference,
  UseDataTableExplorerReturn,
} from './data-table-explorer/types';

// ============================================================================
// Chart Builder UI Components
// ============================================================================

export {MosaicChartBuilder} from './MosaicChartBuilder';

// Chart builder compound components
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
export type {ChartBuilderTypeGridProps} from './chart-builders/ChartBuilderTypeGrid';
export {ChartBuilderTypeGrid} from './chart-builders/ChartBuilderTypeGrid';

// Chart builder form components
export {Field} from './components/Field';
export {TableSelector} from './components/TableSelector';
export {ColumnSelector} from './components/ColumnSelector';
export {MultiFieldSelector} from './components/MultiFieldSelector';
export {
  ColumnsProvider,
  useColumnsContext,
  type ColumnsContextValue,
} from './components/ColumnsContext';
export type {FieldSelectorInputProps} from './components/FieldSelectorInput';

// Chart builder utilities
export {buildChartTitleForSpec} from './chart-builders/chartSpecTitle';
export {
  buildChartTypeTitle,
  canCreateChartFromType,
} from './chart-builders/chartTypeUtils';

// ============================================================================
// Chart Type Definitions & Schemas
// ============================================================================

export {
  // Chart type registry and definitions
  boxPlotChartType,
  scatterPlotChartType,
  countPlotChartType,
  createDefaultChartTypes,
  customSpecChartType,
  heatmapChartType,
  histogramChartType,
  isSpecChartType,
  isComponentChartType,
  lineChartChartType,
  mosaicChartTypes,
  // Chart configuration types
  ChartConfig,
  HistogramChartSettings,
  LineChartSettings,
  CountPlotChartSettings,
  ScatterPlotChartSettings,
  HeatmapChartSettings,
  BoxPlotChartSettings,
} from './charts/chart-types';

export type {
  ChartBuilderColumn,
  ChartBuilderDashboardPanelOutput,
  ChartBuilderField,
  ChartSpec,
  ChartTypeDefinition,
} from './charts/chart-types/base-types';

export type {
  ChartSettings,
  ChartType,
  ChartToolExecutionContext,
  ChartToolParams,
  DashboardToolDeps,
} from './charts/chart-types';
export type {
  ResolvedChartResources,
  CreateChartParams,
  CreateChartResult,
} from './ai/tool-types';

// Column type utilities
export {
  NUMERIC_COLUMN_TYPES,
  QUANTITATIVE_COLUMN_TYPES,
  TEMPORAL_COLUMN_TYPES,
} from './column-types-utils';

// ============================================================================
// AI Tools & Agent Integration
// ============================================================================

// AI tool input schemas (for chart creation)
export {BaseChartToolInput} from './ai/tool-schemas';
export {
  HistogramToolInput,
  LineChartToolInput,
  CountPlotToolInput,
  HeatmapToolInput,
  ScatterPlotToolInput,
  BoxPlotToolInput,
} from './charts/chart-types';

// AI tool creators (for chart generation)
export {
  createHistogramAiTool,
  createLineChartAiTool,
  createCountPlotAiTool,
  createHeatmapAiTool,
  createScatterPlotAiTool,
  createBoxPlotAiTool,
  createChartTools,
} from './charts/chart-types';
export {
  createDataTableExplorerTool,
  DataTableExplorerToolInput,
} from './ai/createDataTableExplorerTool';

// Dashboard and block-document AI tools
export {MAP_TOOL_KEY} from './ai/constants';
export {
  createDashboardAiTools,
  type CreateDashboardAiToolsOptions,
} from './ai/dashboard/createDashboardAiTools';
export type {
  ExtraDashboardAiToolsFactory,
  ExtraDashboardAiToolsParams,
} from './ai/dashboard/dashboard-types';
export {createDashboardAgentTool} from './ai/dashboard/createDashboardAgentTool';
export {
  BLOCK_DOCUMENT_CHART_TOOL_PREFIX,
  KnownMosaicBlockDocumentTools,
} from './ai/block-document/constants';
export {
  createAddMosaicDashboardBlockTool,
  type CreateAddMosaicDashboardBlockToolOptions,
} from './ai/block-document/createAddMosaicDashboardBlockTool';
export {
  createBlockDocumentChartTools,
  type CreateBlockDocumentChartToolsParams,
} from './ai/block-document/createBlockDocumentChartTools';
export {
  createBlockDocumentDataTableExplorerTool,
  type CreateBlockDocumentDataTableExplorerToolParams,
} from './ai/block-document/createBlockDocumentDataTableExplorerTool';

// AI type definitions
export type {
  AiStore,
  BaseAgentToolOptions,
  AgentToolCall,
  AgentRunResult,
} from './ai/types';
export type {DatabaseAiAdapter} from './ai/database-types';
export type {
  CreateDashboardAgentToolOptions,
  DashboardAgentResult,
  DashboardAiAdapter,
} from './ai/dashboard/dashboard-types';

// AI helpers and error handling
export {ensurePanel, ensureTable, ensureNoOverride} from './ai/tool-helpers';
export {AiAgentError} from './ai/errors';
export type {ToolOutput} from './ai/tool-types';

// Block renderers for worksheets
export {ChartBlockRenderer} from './charts/worksheet/ChartBlockRenderer';

// ============================================================================
// Spec Editor Components
// ============================================================================

export {MosaicCodeMirrorEditor} from './editor/MosaicCodeMirrorEditor';
export {useMosaicEditorContext} from './editor/MosaicEditorContext';
export {
  getCachedMosaicSchema,
  loadMosaicSchema,
  preloadMosaicSchema,
} from './editor/mosaicSchema';
export {useMosaicChartEditor} from './editor/useMosaicChartEditor';

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

// ============================================================================
// Utilities
// ============================================================================

export {getTableReference} from './utils/table-lookup';
