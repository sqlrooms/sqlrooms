import {Spec} from '@uwdata/mosaic-spec';
import {ComponentType} from 'react';

/**
 * Describes a field selector in a chart builder UI
 */
export interface MosaicChartBuilderField {
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
 * Describes a chart builder template that generates Mosaic JSON specs
 */
export interface MosaicChartBuilder {
  /** Unique identifier */
  id: string;
  /** Icon component */
  icon: ComponentType<{className?: string}>;
  /** Short description of what this builder creates */
  description: string;
  /** Field selectors the user must fill in */
  fields: MosaicChartBuilderField[];
  /** Generate a Mosaic spec from table name and selected field values */
  createSpec: (tableName: string, values: Record<string, string>) => Spec;
}

/**
 * Column info passed to chart builder UI
 */
export interface ChartBuilderColumn {
  name: string;
  type: string;
}
