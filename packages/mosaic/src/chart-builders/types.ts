import type {Spec} from '@uwdata/mosaic-spec';
import type {ComponentType} from 'react';

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
 * Shared chart-type definition used by both the chart-builder UI and
 * assistant-driven chart creation.
 */
export interface ChartTypeDefinition {
  /** Unique identifier */
  id: string;
  /** Short human-friendly name used in chart-type grids and prompts */
  label?: string;
  /** Short description of what this builder creates */
  description: string;
  /** Field selectors the user must fill in */
  fields: ChartBuilderField[];
  /** Generate a Mosaic spec from table name and selected field values */
  createSpec: (tableName: string, values: Record<string, string>) => Spec;
  /** Generate a chart title from selected field values */
  buildTitle?: (fieldValues: Record<string, string>) => string;
  /** Optional availability override for a given table schema */
  isAvailable?: (columns: ChartBuilderColumn[]) => boolean;
  /** Optional extra assistant-facing description */
  aiDescription?: string;
}

/**
 * Describes a chart builder template that generates Mosaic JSON specs
 * (includes an icon for the chart-type grid).
 */
export interface ChartBuilderTemplate extends ChartTypeDefinition {
  /** Icon component */
  icon: ComponentType<{className?: string}>;
}

/**
 * Column info passed to chart builder UI
 */
export interface ChartBuilderColumn {
  name: string;
  type: string;
}

/**
 * Backward-compatible alias for earlier chart-builder helper APIs.
 * Prefer {@link ChartTypeDefinition} for new code.
 */
export type ChartSpec = ChartTypeDefinition;

/** Strip UI-only fields from a template for non-UI chart-type contexts. */
export function toChartTypeDefinition(
  template: ChartBuilderTemplate,
): ChartTypeDefinition {
  const {
    id,
    label,
    description,
    fields,
    createSpec,
    buildTitle,
    isAvailable,
    aiDescription,
  } = template;
  return {
    id,
    label,
    description,
    fields,
    createSpec,
    buildTitle,
    isAvailable,
    aiDescription,
  };
}

/** Backward-compatible alias for earlier helper APIs. */
export const toChartSpec = toChartTypeDefinition;
