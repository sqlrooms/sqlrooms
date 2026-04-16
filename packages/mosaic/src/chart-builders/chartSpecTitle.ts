import type {ChartTypeDefinition} from './types';
import {buildChartTypeTitle} from './chartTypeUtils';

/**
 * Human-readable chart title from a chart type and selected field values.
 */
export function buildChartTitleForSpec(
  spec: Pick<ChartTypeDefinition, 'description' | 'buildTitle'>,
  fieldValues: Record<string, string>,
): string {
  return buildChartTypeTitle(spec, fieldValues);
}
