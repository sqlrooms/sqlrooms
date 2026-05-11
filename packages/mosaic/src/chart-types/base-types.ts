/**
 * Base types for chart configurations.
 * Separated to avoid circular dependencies.
 */

import type {Spec} from '@uwdata/mosaic-spec';
import type {Coordinator} from '@uwdata/mosaic-core';
import type React from 'react';

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
 * Props passed to chart renderer components.
 */
export interface ChartRendererProps<TSettings = any> {
  tableName: string;
  settings: TSettings;
  coordinator: Coordinator;
  /**
   * Pre-defined params/selections to inject when rendering vgplot specs.
   * Keys are param names (without $), values are Param or Selection instances.
   */
  params?: Map<string, any>;
  /**
   * Optional retention adapter for preserving the underlying vgplot
   * instance across temporary unmount/remount cycles.
   */
  retention?: {
    chart?: any;
    setChart: (chart: any) => void;
  };
}

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

  /** Required renderer component for this chart type */
  renderer: React.ComponentType<ChartRendererProps<TSettings>>;

  /** Generate a chart title from selected field values */
  buildTitle?: (fieldValues: Record<string, string>) => string;
  /** Optional availability override for a given table schema */
  isAvailable?: (columns: ChartBuilderColumn[]) => boolean;
  /** Optional extra assistant-facing description */
  aiDescription?: string;

  // Backward compatibility fields - prefer using renderer
  /**
   * @deprecated Use renderer instead. This field is kept for backward compatibility
   * with chart settings and validation. Will be removed in a future version.
   */
  createSpec?: (tableName: string, settings: TSettings) => Spec;
  /**
   * @deprecated Use renderer instead. This field is kept for backward compatibility
   * with custom dashboard panel types. Will be removed in a future version.
   */
  createOutput?: (tableName: string, settings: TSettings) => ChartBuilderOutput;
  /**
   * @deprecated No longer used. Kept for backward compatibility.
   */
  outputKind?: 'vgplot' | 'dashboard-panel';
}
