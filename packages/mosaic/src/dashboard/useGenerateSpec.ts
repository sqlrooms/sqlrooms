import {useMemo} from 'react';
import type {Spec} from '@uwdata/mosaic-spec';
import {ChartSpecError} from '../chart-types/errors';
import type {VgPlotChartSettings} from '../chart-types/chart-config';
import {ChartTypeDefinition, isSpecChartType} from '../chart-types/base-types';

export type UseGenerateSpecResult =
  | {
      spec: Spec;
      error?: undefined;
    }
  | {
      spec?: undefined;

      error: ChartSpecError;
    };

export function useGenerateSpec(
  tableName: string,
  settings: VgPlotChartSettings,
  chartTypeDefinition: ChartTypeDefinition,
): UseGenerateSpecResult {
  return useMemo(() => {
    try {
      if (!isSpecChartType(chartTypeDefinition)) {
        return {
          error: new ChartSpecError('Invalid chart type definition'),
        };
      }

      const spec = chartTypeDefinition.createSpec(tableName, settings);

      return {
        spec,
      };
    } catch (error) {
      if (error instanceof ChartSpecError) {
        // SpecGenerationError is expected as part of validation logic, don't log
        return {
          error,
        };
      }

      // Unexpected error - log and create a ChartSpecError for consistency
      console.error(
        '[useGenerateSpec] Unexpected error generating chart spec:',
        error,
      );

      return {
        error: new ChartSpecError('An unexpected error occurred'),
      };
    }
  }, [chartTypeDefinition, tableName, settings]);
}
