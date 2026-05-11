import type {Spec} from '@uwdata/mosaic-spec';
import {
  mosaicChartTypes,
  type VgPlotChartSettings,
  type VgPlotChartType,
} from '../chart-types';

/**
 * @deprecated This function is deprecated with the renderer pattern migration.
 * Chart types now generate specs internally within their renderer components.
 *
 * Generates a Mosaic chart specification from chart settings.
 *
 * @param tableName - The source table name. Returns null if undefined.
 * @param chartType - The type of chart to generate (histogram, line, etc.)
 * @param settings - Chart-specific settings matching the chart type
 * @returns A Mosaic Spec object or null if generation fails
 *
 * @example
 * const spec = generateMosaicChartSpec('sales', 'histogram', { field: 'amount' });
 */
export function generateMosaicChartSpec(
  tableName: string | undefined,
  chartType: VgPlotChartType,
  settings: VgPlotChartSettings | Record<string, unknown>,
): Spec | null {
  if (!tableName) {
    return null;
  }

  const chartTypeDef = Object.values(mosaicChartTypes).find(
    ({id}) => id === chartType,
  );

  if (!chartTypeDef) {
    console.error(`[generateMosaicChartSpec] Unknown chart type: ${chartType}`);
    return null;
  }

  if (!chartTypeDef.createSpec) {
    console.error(
      `[generateMosaicChartSpec] Chart type "${chartType}" does not create a vgplot spec`,
    );
    return null;
  }

  try {
    return chartTypeDef.createSpec(tableName, settings);
  } catch (error) {
    console.error(
      `[generateMosaicChartSpec] Failed to generate spec for chart type "${chartType}":`,
      error,
    );
    return null;
  }
}
