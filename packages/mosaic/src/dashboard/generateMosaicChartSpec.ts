import type {Spec} from '@uwdata/mosaic-spec';
import {mosaicChartTypes} from '../chart-types/index';
import {type VgPlotChartSettings} from '../chart-types/chart-config';
import {type VgPlotChartType} from '../chart-types/base-types';
import {
  ChartSpecError,
  MissingTableError,
  SpecGenerationError,
  UnknownChartTypeError,
} from '../chart-types/errors';

/**
 * Generates a Mosaic chart specification from chart settings.
 *
 * @param tableName - The source table name
 * @param chartType - The type of chart to generate (histogram, line, etc.)
 * @param settings - Chart-specific settings matching the chart type
 * @returns A Mosaic Spec object
 * @throws {MissingTableError} If tableName is undefined
 * @throws {UnknownChartTypeError} If chartType is not recognized
 * @throws {SpecGenerationError} If spec creation fails (wraps original error from createSpec)
 *
 * @example
 * const spec = generateMosaicChartSpec('sales', 'histogram', { field: 'amount' });
 */
export function generateMosaicChartSpec(
  tableName: string | undefined,
  chartType: VgPlotChartType,
  settings: VgPlotChartSettings | Record<string, unknown>,
): Spec {
  // Find chart type definition
  const chartTypeDef = Object.values(mosaicChartTypes).find(
    ({id}) => id === chartType,
  );

  if (!chartTypeDef) {
    throw new UnknownChartTypeError(chartType);
  }

  // Custom spec doesn't require a table name
  if (chartType !== 'custom-spec' && !tableName) {
    throw new MissingTableError();
  }

  // Generate spec - createSpec will throw SpecGenerationError if settings are invalid
  try {
    const spec = chartTypeDef.createSpec(tableName!, settings as any);
    console.log('[generateMosaicChartSpec] Generated spec:', {
      tableName,
      chartType,
      settings,
      spec,
    });
    return spec;
  } catch (error) {
    console.error('[generateMosaicChartSpec] Error:', {
      tableName,
      chartType,
      settings,
      error,
    });
    // Re-throw if already a ChartSpecError (including SpecGenerationError)
    if (error instanceof ChartSpecError) {
      throw error;
    }
    // Wrap unexpected errors
    const message =
      error instanceof Error ? error.message : 'Failed to generate chart';
    throw new SpecGenerationError(message);
  }
}
