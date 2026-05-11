/**
 * Base types for chart configurations.
 * Separated to avoid circular dependencies.
 */

import type {Spec} from '@uwdata/mosaic-spec';
import type {ComponentType} from 'react';
import type * as z from 'zod';
import type {Tool} from 'ai';
import {VgPlotChartType} from './chart-config';

// Re-export VgPlotChartType for convenience
export type {VgPlotChartType};

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
 * Dependencies injected into chart tool creation functions.
 * Provides the resources and operations needed to create charts.
 */
export interface ChartToolDeps {
  resolveResources: (params: {
    artifactId?: string;
    tableName?: string;
    createArtifactIfMissing?: boolean;
  }) => {
    artifactId: string;
    tableName: string;
    columns: ChartBuilderColumn[];
  };
  createChart: (params: {
    artifactId: string;
    tableName: string;
    title: string;
    config: any;
  }) => {
    panelId: string;
    artifactId: string;
    tableName: string;
    title: string;
    config: any;
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
  /** Zod schema for runtime validation of settings */
  schema: z.ZodType<TSettings>;
  /** Generate a Mosaic spec from table name and selected field values */
  createSpec: (tableName: string, values: TSettings) => Spec;
  /** Create an AI tool for this chart type */
  createTool?: (deps: ChartToolDeps) => Tool;
  /** Generate a chart title from selected field values */
  buildTitle?: (fieldValues: Record<string, unknown>) => string;
  /** Optional availability override for a given table schema */
  isAvailable?: (columns: ChartBuilderColumn[]) => boolean;
  /** Optional extra assistant-facing description */
  aiDescription?: string;
  /** Explicit settings component for this chart type */
  settingsComponent: ComponentType;
  /** Optional icon component for chart-type grids */
  icon: ComponentType<{className?: string}>;
}

/**
 * Backward-compatible alias for earlier chart-builder helper APIs.
 * @deprecated Use {@link ChartTypeDefinition} instead.
 */
export type ChartSpec = ChartTypeDefinition;
