/**
 * Base types for chart configurations.
 * Separated to avoid circular dependencies.
 */

import type {Spec} from '@uwdata/mosaic-spec';

/**
 * Supported chart type identifiers
 */
export type VgPlotChartType =
  | 'histogram'
  | 'count-plot'
  | 'ecdf'
  | 'line-chart'
  | 'bubble-chart'
  | 'heatmap'
  | 'box-plot'
  | 'custom-spec';

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
}

/**
 * Column info passed to chart builder UI
 */
export interface ChartBuilderColumn {
  name: string;
  type: string;
}

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

/**
 * Shared chart-type definition used by both the chart-builder UI and
 * assistant-driven chart creation.
 */
export interface ChartTypeDefinition<TSettings = any> {
  /** Unique identifier */
  id: VgPlotChartType;
  /** Short human-friendly name used in chart-type grids and prompts */
  label?: string;
  /** Short description of what this builder creates */
  description: string;
  /** Field selectors the user must fill in */
  fields: ChartBuilderField[];
  /** Generate a Mosaic spec from table name and selected field values */
  createSpec?: (tableName: string, values: TSettings) => Spec;
  /** Generate a chart-builder output from table name and selected field values */
  createOutput?: (tableName: string, values: TSettings) => ChartBuilderOutput;
  /** Output surface required by this chart type. Defaults to `vgplot`. */
  outputKind?: ChartBuilderOutput['kind'];
  /** Generate a chart title from selected field values */
  buildTitle?: (fieldValues: Record<string, string>) => string;
  /** Optional availability override for a given table schema */
  isAvailable?: (columns: ChartBuilderColumn[]) => boolean;
  /** Optional extra assistant-facing description */
  aiDescription?: string;
}
