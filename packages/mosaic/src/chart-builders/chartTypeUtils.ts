import type {
  ChartBuilderColumn,
  ChartBuilderField,
  ChartTypeDefinition,
} from './types';

export {
  NUMERIC_COLUMN_TYPES,
  TEMPORAL_COLUMN_TYPES,
  QUANTITATIVE_COLUMN_TYPES,
} from './constants';

/**
 * Build a default chart title from description and field values
 */
export function buildDefaultChartTitle(
  description: string,
  fieldValues: Record<string, string>,
): string {
  const baseTitle = description.replace(/^Create (a |an )?/, '');
  const selectedFields = Object.values(fieldValues).filter(Boolean);

  return selectedFields.length > 0
    ? `${baseTitle} - ${selectedFields.join(', ')}`
    : baseTitle;
}

/**
 * Create a title builder function from a description string
 */
export function titleFromDescription(description: string) {
  return (fieldValues: Record<string, string>) =>
    buildDefaultChartTitle(description, fieldValues);
}

export function columnMatchesFieldTypes(
  column: ChartBuilderColumn,
  field: Pick<ChartBuilderField, 'types'>,
): boolean {
  if (!field.types?.length) return true;
  return field.types.some(
    (type) => column.type.toUpperCase() === type.toUpperCase(),
  );
}

export function getCompatibleColumns(
  columns: ChartBuilderColumn[],
  field: Pick<ChartBuilderField, 'types'>,
): ChartBuilderColumn[] {
  return columns.filter((column) => columnMatchesFieldTypes(column, field));
}

export function isChartTypeAvailable(
  chartType: ChartTypeDefinition,
  columns: ChartBuilderColumn[],
): boolean {
  if (chartType.isAvailable) {
    return chartType.isAvailable(columns);
  }

  return chartType.fields
    .filter((field) => field.required !== false)
    .every((field) => getCompatibleColumns(columns, field).length > 0);
}

export function getAvailableChartTypes(
  chartTypes: ChartTypeDefinition[],
  columns: ChartBuilderColumn[],
): ChartTypeDefinition[] {
  return chartTypes.filter((chartType) =>
    isChartTypeAvailable(chartType, columns),
  );
}

export function buildChartTypeTitle(
  chartType: Pick<ChartTypeDefinition, 'description' | 'buildTitle'>,
  fieldValues: Record<string, string>,
): string {
  return chartType.buildTitle
    ? chartType.buildTitle(fieldValues)
    : buildDefaultChartTitle(chartType.description, fieldValues);
}

export function canCreateChartFromType(
  chartType: ChartTypeDefinition | null | undefined,
  fieldValues: Record<string, string>,
  columns: ChartBuilderColumn[],
): boolean {
  if (!chartType) return false;

  return chartType.fields
    .filter((field) => field.required !== false)
    .every((field) => {
      const value = fieldValues[field.key];
      if (!value) return false;
      const column = columns.find((candidate) => candidate.name === value);
      return Boolean(column && columnMatchesFieldTypes(column, field));
    });
}
