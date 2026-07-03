/**
 * Base types for chart configurations.
 * Separated to avoid circular dependencies.
 */

import type {Spec} from '@uwdata/mosaic-spec';
import {type Tool} from 'ai';
import type {Coordinator} from '@uwdata/mosaic-core';
import type {ComponentType} from 'react';
import type * as z from 'zod';
import {ChartConfig, ChartSettings, ChartType} from './chart-config';
import {RetainedVgPlotChart} from '../../VgPlotChart';
import type {Selection} from '@uwdata/mosaic-core';
import type {DataTableExplorerPanelConfig} from '../../dashboard/core-types';
import type {MosaicDashboardEntry} from '../../dashboard/dashboard-types';
import type {
  ChartDataPolicy,
  ChartDataPolicyContext,
  ChartRuntimeIssue,
  ChartRuntimeIssueContext,
  ChartRuntimeIssueReporter,
} from '../../chart-runtime';
import {ChartToolParams} from './tool-types';
import {DataTable, type QualifiedTableName} from '@sqlrooms/duckdb';
import {getMosaicVgPlotTableReference} from '../../mosaicTableReference';
import type {ChartBuilderColumn} from './column-types';

export type {ChartType};
export type {ChartBuilderColumn};

/**
 * Describes a field selector in a chart builder UI
 */
export interface ChartBuilderField {
  /** Unique key for this field */
  key: string;
  /** Display label */
  label: string;
  /** Whether the field is required */
  required?: boolean;
  /** Filter columns by DuckDB type (e.g. 'INTEGER', 'VARCHAR', 'DOUBLE') */
  types?: string[];
  /** Optional helper text for AI or custom UIs */
  description?: string;
  /** Whether this field accepts multiple values (array) */
  multiple?: boolean;
}

/**
 * Result of table resolution.
 * tableName is the canonical quoted string boundary form
 * (QualifiedTableName.toString()); qualifiedName is the canonical structured
 * identity when available.
 */
export interface ResolvedTable {
  tableName: string;
  qualifiedName: QualifiedTableName;
  columns: ChartBuilderColumn[];
}

/**
 * Partial update to apply to a dashboard panel.
 * Config can be any of the panel config types (chart, dataTableExplorer).
 */
export interface PanelPatch {
  title?: string;
  source?: ChartBuilderPanelSource;
  config?: ChartConfig | DataTableExplorerPanelConfig;
}

/**
 * Dependencies injected into dashboard tool creation functions.
 * Provides the resources and operations needed to create dashboard panels.
 */
/**
 * Dependencies for dashboard-specific tools that manage panels.
 */
export interface DashboardToolDeps {
  addPanel: (dashboardId: string, panel: any) => string;
  updatePanel: (
    dashboardId: string,
    panelId: string,
    patch: Partial<PanelPatch>,
  ) => void;
  getDashboard: (dashboardId: string) => MosaicDashboardEntry | undefined;
  getPanelIssue?: (
    dashboardId: string,
    panelId: string,
  ) => ChartRuntimeIssue | undefined;
  removePanel: (dashboardId: string, panelId: string) => void;
  setCurrentArtifact: (artifactId: string) => void;
}

export type ChartToolExecutionContext = object & {
  sessionId?: string;
  aiRunContext?: unknown;
};

export type ChartBuilderPanelSource = {
  tableName?: string;
  sqlQuery?: string;
};

export type ChartBuilderVgPlotOutput = {
  kind: 'vgplot';
  spec: Spec;
};

export type ChartBuilderDashboardPanelOutput = {
  kind: 'dashboard-panel';
  type: string;
  source?: ChartBuilderPanelSource;
  config?: Record<string, unknown>;
};

export type ChartBuilderOutput =
  | ChartBuilderVgPlotOutput
  | ChartBuilderDashboardPanelOutput;

export type ChartRetainer = {
  chart: RetainedVgPlotChart | undefined;
  setChart: (chart: RetainedVgPlotChart) => void;
};

export type BrushSelectionParams = Map<string, Selection>;

/**
 * Props passed to component-based chart renderers.
 *
 * Renderers receive the resolved chart configuration, Mosaic coordinator, and
 * optional runtime services needed to participate in dashboard filtering and
 * error reporting. The `table` property is the canonical structured SQLRooms
 * table identity; renderers must convert it through the appropriate SQL dialect
 * helper instead of reconstructing table references from display names.
 */
export interface ChartRendererProps<TConfig extends ChartConfig = ChartConfig> {
  /** Resolved table metadata for the chart's data source. */
  dataTable: DataTable;
  /** Canonical qualified table identity for the chart's data source. */
  table: QualifiedTableName;
  /** Validated chart configuration for this renderer. */
  config: TConfig;
  /** Mosaic coordinator used to connect query clients and selections. */
  coordinator: Coordinator;
  /** Optional row-limit policy applied to renderer-managed queries. */
  dataPolicy?: ChartDataPolicy | null;
  /** Context attached to runtime issues reported by the renderer. */
  runtimeIssueContext?: ChartRuntimeIssueContext;
  /** Reporter used to surface renderer query or policy failures. */
  runtimeIssueReporter?: ChartRuntimeIssueReporter;
  /**
   * Pre-defined params/selections to inject when rendering vgplot specs.
   * Keys are param names (without $), values are Param or Selection instances.
   */
  params?: BrushSelectionParams;
  /**
   * Optional retention adapter for preserving the underlying vgplot
   * instance across temporary unmount/remount cycles.
   */
  retention?: ChartRetainer;
}

type BaseChartTypeDefinition<TConfig extends ChartConfig = ChartConfig> = {
  /** Unique identifier */
  id: ChartType;
  /** Short human-friendly name used in chart-type grids and prompts */
  label?: string;
  /** Short description of what this builder creates */
  description: string;
  /** Concise description for AI agents explaining when and how to use this chart type */
  aiDescription: string;
  /** Zod schema for runtime validation of settings */
  schema: z.ZodType<TConfig['settings']>;
  /** Generate a chart title from selected field values */
  buildTitle?: (fieldValues: Record<string, unknown>) => string;
  /** Optional availability override for a given table schema */
  isAvailable?: (columns: ChartBuilderColumn[]) => boolean;
  /** Explicit settings component for this chart type */
  settingsComponent: ComponentType;
  /** Optional icon component for chart-type grids */
  icon: ComponentType<{className?: string}>;
  /** Optional function to create a chart configuration AI tool */
  createTool?: (deps: ChartToolParams) => Tool;
  /** Optional runtime data policy for renderer-specific query validation. */
  getDataPolicy?: (
    context: ChartDataPolicyContext<TConfig>,
  ) => ChartDataPolicy | null | undefined;
};

export type CreateSpecOptions<TSettings = ChartSettings> = {
  dataTable: DataTable;
  settings: TSettings;
  selectionName?: string;
};

export type ValidateSpecOptions<TSettings = ChartSettings> = Pick<
  CreateSpecOptions<TSettings>,
  'dataTable' | 'settings'
>;

export function getChartTableReference(dataTable: DataTable): string {
  return getMosaicVgPlotTableReference(dataTable.table);
}

export const getChartTableReferenceString = getChartTableReference;

export type SpecChartTypeDefinition<TConfig extends ChartConfig = ChartConfig> =
  BaseChartTypeDefinition<TConfig> & {
    createSpec: (options: CreateSpecOptions<TConfig['settings']>) => Spec;
    canViewSpec?: boolean;
  };

export type ComponentChartTypeDefinition<
  TConfig extends ChartConfig = ChartConfig,
> = BaseChartTypeDefinition<TConfig> & {
  renderer: ComponentType<ChartRendererProps<TConfig>>;
};

/**
 * Shared chart-type definition used by both the chart-builder UI and
 * assistant-driven chart creation.
 */
export type ChartTypeDefinition<TConfig extends ChartConfig = ChartConfig> =
  | SpecChartTypeDefinition<TConfig>
  | ComponentChartTypeDefinition<TConfig>;

export function isSpecChartType<TConfig extends ChartConfig>(
  chartType: ChartTypeDefinition<TConfig>,
): chartType is SpecChartTypeDefinition<TConfig> {
  return 'createSpec' in chartType;
}

export function isComponentChartType<TConfig extends ChartConfig>(
  chartType: ChartTypeDefinition<TConfig>,
): chartType is ComponentChartTypeDefinition<TConfig> {
  return 'renderer' in chartType;
}

/**
 * Backward-compatible alias for earlier chart-builder helper APIs.
 * @deprecated Use {@link ChartTypeDefinition} instead.
 */
export type ChartSpec = ChartTypeDefinition;
