import {z} from 'zod';
import type {ChartBuilderColumn} from './base-types';
import {VgPlotChartConfig} from './chart-config';

export const BaseChartToolParameters = z.object({
  artifactId: z
    .string()
    .optional()
    .describe('Optional dashboard artifact ID. Defaults to current dashboard.'),
  tableName: z
    .string()
    .optional()
    .describe('Optional table name. Use when no table is selected yet.'),
  createArtifactIfMissing: z
    .boolean()
    .optional()
    .default(true)
    .describe('If true, create dashboard artifact if missing.'),
  reasoning: z.string().describe('Brief rationale for the chart choice.'),
});

export interface FieldValidationSpec {
  required?: boolean;
  multiple?: boolean;
  types?: string[];
  label: string;
}

export interface ResolvedChartResourcesParams {
  artifactId?: string;
  tableName?: string;
  createArtifactIfMissing?: boolean;
}

export interface ResolvedChartResources {
  artifactId: string;
  tableName: string;
  columns: ChartBuilderColumn[];
}

export interface CreateChartParams {
  artifactId: string;
  tableName: string;
  title: string;
  config: VgPlotChartConfig;
}

export interface CreateChartResult {
  panelId: string;
  artifactId: string;
  tableName: string;
  title: string;
  config: VgPlotChartConfig;
}

export interface ChartToolDeps {
  validateField: (
    fieldKey: string,
    value: unknown,
    field: FieldValidationSpec,
    columns: ChartBuilderColumn[],
  ) => void;
  resolveResources: (
    params: ResolvedChartResourcesParams,
  ) => ResolvedChartResources;
  createChart: (params: CreateChartParams) => CreateChartResult;
}

export function validateFieldValue(
  fieldKey: string,
  value: unknown,
  field: FieldValidationSpec,
  columns: ChartBuilderColumn[],
) {
  if (field.required && !value) {
    throw new Error(`Missing required field "${fieldKey}" (${field.label}).`);
  }

  if (!value) {
    return;
  }

  // Handle multiple fields (arrays)
  if (field.multiple) {
    if (!Array.isArray(value)) {
      throw new Error(
        `Field "${fieldKey}" expects an array of field configurations.`,
      );
    }
    if (value.length === 0) {
      throw new Error(`Field "${fieldKey}" requires at least one item.`);
    }
    for (const item of value) {
      if (typeof item !== 'object' || item === null || !('field' in item)) {
        throw new Error(
          `Field "${fieldKey}" array items must have a "field" property.`,
        );
      }
      const fieldName = (item as {field: string}).field;
      validateColumnExists(fieldName, field.types, columns, fieldKey);
    }
    return;
  }

  // Handle single fields (strings)
  if (typeof value !== 'string') {
    throw new Error(`Field "${fieldKey}" expects a string column name.`);
  }

  validateColumnExists(value, field.types, columns, fieldKey);
}

function validateColumnExists(
  columnName: string,
  expectedTypes: string[] | undefined,
  columns: ChartBuilderColumn[],
  fieldKey: string,
) {
  const column = columns.find((candidate) => candidate.name === columnName);
  if (!column) {
    throw new Error(
      `Unknown column "${columnName}" for field "${fieldKey}". Available columns: ${columns.map((c) => c.name).join(', ') || '(none)'}.`,
    );
  }

  if (
    expectedTypes?.length &&
    !expectedTypes.some(
      (type) => type.toUpperCase() === column.type.toUpperCase(),
    )
  ) {
    throw new Error(
      `Column "${columnName}" has type ${column.type} but field "${fieldKey}" expects ${expectedTypes.join(', ')}.`,
    );
  }
}
