import type {ChartTypeDefinition} from './types';

export {
  NUMERIC_COLUMN_TYPES,
  TEMPORAL_COLUMN_TYPES,
  QUANTITATIVE_COLUMN_TYPES,
} from './constants';

/**
 * Type guard to check if value has a field property (e.g., YFieldConfig)
 */
function hasFieldProperty(value: unknown): value is {field: string} {
  return (
    typeof value === 'object' &&
    value !== null &&
    'field' in value &&
    typeof value.field === 'string'
  );
}

/**
 * Build a default chart title from description and field values
 */
export function buildDefaultChartTitle(
  description: string,
  fieldValues: Record<string, unknown>,
): string {
  const baseTitle = description.replace(/^Create (a |an )?/, '');
  const selectedFields = Object.values(fieldValues)
    .filter(Boolean)
    .map((value) => {
      // Handle array values (e.g., yFields)
      if (Array.isArray(value)) {
        return value
          .map((item) => (hasFieldProperty(item) ? item.field : item))
          .filter(Boolean)
          .join(', ');
      }
      return String(value);
    })
    .filter(Boolean);

  return selectedFields.length > 0
    ? `${baseTitle} - ${selectedFields.join(', ')}`
    : baseTitle;
}

/**
 * Create a title builder function from a description string
 */
export function titleFromDescription(description: string) {
  return (fieldValues: Record<string, unknown>) =>
    buildDefaultChartTitle(description, fieldValues);
}

export function buildChartTypeTitle(
  chartType: Pick<ChartTypeDefinition, 'description' | 'buildTitle'>,
  fieldValues: Record<string, unknown>,
): string {
  return chartType.buildTitle
    ? chartType.buildTitle(fieldValues)
    : buildDefaultChartTitle(chartType.description, fieldValues);
}

export function canCreateChartFromType(
  chartTypeDefinition: ChartTypeDefinition | null | undefined,
  fieldValues: Record<string, unknown>,
): boolean {
  return chartTypeDefinition?.schema.safeParse(fieldValues)?.success ?? false;
}
