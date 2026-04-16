import type {ChartSpec} from './types';

/**
 * Human-readable chart title from a spec and selected field values.
 * Matches the logic used in {@link ChartBuilderContent}.
 */
export function buildChartTitleForSpec(
  spec: Pick<ChartSpec, 'description' | 'fields'>,
  fieldValues: Record<string, string>,
): string {
  return spec.fields.length > 0
    ? `${spec.description.replace(/^Create (a |an )?/, '')} - ${Object.values(fieldValues).join(', ')}`
    : spec.description.replace(/^Create (a |an )?/, '');
}
