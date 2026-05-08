import {useMemo} from 'react';
import type {Spec} from '@uwdata/mosaic-spec';
import {generateMosaicChartSpec} from './generateMosaicChartSpec';
import {ChartSpecError} from '../chart-types/errors';
import type {VgPlotChartSettings} from '../chart-types/chart-config';
import type {VgPlotChartType} from '../chart-types/base-types';

export interface UseGenerateSpecResult {
  /** Generated Mosaic spec, or null if generation failed */
  spec: Spec | null;
  /** Error that occurred during spec generation. Use error.message for display. */
  error: ChartSpecError | null;
}

/**
 * React hook to generate a Mosaic chart specification with error handling.
 *
 * @param tableName - The source table name
 * @param chartType - The type of chart to generate
 * @param settings - Chart-specific settings
 * @returns Object containing spec, error, and errorMessage
 *
 * @example
 * const {spec, errorMessage} = useGenerateSpec(
 *   tableName,
 *   'histogram',
 *   {field: 'amount'}
 * );
 */
export function useGenerateSpec(
  tableName: string | undefined,
  chartType: VgPlotChartType,
  settings: VgPlotChartSettings | Record<string, unknown>,
): UseGenerateSpecResult {
  return useMemo(() => {
    try {
      const spec = generateMosaicChartSpec(tableName, chartType, settings);
      return {
        spec,
        error: null,
      };
    } catch (error) {
      if (error instanceof ChartSpecError) {
        // SpecGenerationError is expected as part of validation logic, don't log
        return {
          spec: null,
          error,
        };
      }

      // Unexpected error - log and create a ChartSpecError for consistency
      console.error(
        '[useGenerateSpec] Unexpected error generating chart spec:',
        error,
      );

      return {
        spec: null,
        error: new ChartSpecError('An unexpected error occurred'),
      };
    }
  }, [tableName, chartType, settings]);
}
