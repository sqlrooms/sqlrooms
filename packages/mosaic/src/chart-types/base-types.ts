/**
 * Base types for chart configurations.
 * Separated to avoid circular dependencies.
 */

import type {Spec} from '@uwdata/mosaic-spec';
import {type Tool} from 'ai';
import type {Coordinator} from '@uwdata/mosaic-core';
import type {ComponentType} from 'react';
import type * as z from 'zod';
import {ChartConfig, ChartType} from './chart-config';
import {RetainedVgPlotChart} from '../VgPlotChart';
import type {Selection} from '@uwdata/mosaic-core';
import type {MosaicDashboardEntry} from '../dashboard/dashboard-types';

// Re-export ChartType for convenience
export type {ChartType};

/**
 * Column info passed to chart builder UI
 */
export interface ChartBuilderColumn {
  name: string;
  type: string;
}

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
 * Result of table resolution, includes table name and column metadata.
 */
export interface ResolvedTable {
  tableName: string;
  columns: ChartBuilderColumn[];
}

/**
 * Partial update to apply to a dashboard panel.
 */
export interface PanelPatch {
  title?: string;
  config?: any;
}

/**
 * Dependencies injected into dashboard tool creation functions.
 * Provides the resources and operations needed to create dashboard panels.
 */
export interface DashboardToolDeps {
  /**
   * Resolves the dashboard artifact ID.
   * Use this when you only need the artifact and not table information.
   */
  resolveArtifact: (
    artifactId?: string,
    createIfMissing?: boolean,
    context?: ChartToolExecutionContext,
  ) => string;

  /**
   * Resolves table name and columns for a given dashboard artifact.
   * Use this when you need table-specific information.
   */
  resolveTable: (artifactId: string, tableName?: string) => ResolvedTable;

  addPanel: (dashboardId: string, panel: any) => string;
  updatePanel: (
    dashboardId: string,
    panelId: string,
    patch: Partial<PanelPatch>,
  ) => void;
  getDashboard: (dashboardId: string) => MosaicDashboardEntry | undefined;
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
 * Props passed to chart renderer components.
 */
export interface ChartRendererProps<TConfig extends ChartConfig = ChartConfig> {
  tableName: string;
  config: TConfig;
  coordinator: Coordinator;
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
  /** Optional function to create an AI tool for this chart type */
  createTool?: (deps: DashboardToolDeps) => Tool;
};

export type SpecChartTypeDefinition<TConfig extends ChartConfig = ChartConfig> =
  BaseChartTypeDefinition<TConfig> & {
    createSpec: (tableName: string, config: TConfig['settings']) => Spec;
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
