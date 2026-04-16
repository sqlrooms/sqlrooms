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
}

/**
 * Pure-data chart specification (no React). Use for AI prompts, tools, and
 * sharing logic with {@link ChartBuilderTemplate}.
 */
export interface ChartSpec {
  /** Unique identifier */
  id: string;
  /** Short description of what this builder creates */
  description: string;
  /** Field selectors the user must fill in */
  fields: ChartBuilderField[];
  /** Generate a Mosaic spec from table name and selected field values */
  createSpec: (tableName: string, values: Record<string, string>) => Spec;
}

/**
 * Describes a chart builder template that generates Mosaic JSON specs
 * (includes an icon for the chart-type grid).
 */
export interface ChartBuilderTemplate extends ChartSpec {
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

/** Strip UI-only fields from a template for AI / serialization contexts. */
export function toChartSpec(template: ChartBuilderTemplate): ChartSpec {
  const {id, description, fields, createSpec} = template;
  return {id, description, fields, createSpec};
}
