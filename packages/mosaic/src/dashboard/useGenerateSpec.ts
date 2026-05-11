import {useMemo} from 'react';
import type {Spec} from '@uwdata/mosaic-spec';
import {generateMosaicChartSpec} from './generateMosaicChartSpec';
import {ChartSpecError} from '../chart-types/errors';
import type {VgPlotChartSettings} from '../chart-types/chart-config';
import type {VgPlotChartType} from '../chart-types/base-types';

export interface UseGenerateSpecResult {
  /** Generated Mosaic spec, or null if generation failed */
  spec?: Spec;
  /** Renderable Mosaic spec with non-renderable properties removed, or null if generation failed or spec is invalid */
  renderableSpec?: Spec;
  /** Error that occurred during spec generation. Use error.message for display. */
  error?: ChartSpecError;
}

/**
 * React hook to generate a Mosaic chart specification with error handling.
 *
 * Generates both the raw spec and a renderable version with non-renderable
 * properties (like $schema) removed for consumption by Mosaic runtime.
 *
 * @param tableName - The source table name (undefined if not yet loaded)
 * @param chartType - The type of chart to generate
 * @param settings - Chart-specific settings
 * @returns Object containing the generated spec, renderable spec ready for Mosaic runtime, and any error that occurred
 *
 * @example
 * const {spec, renderableSpec, error} = useGenerateSpec(
 *   tableName,
 *   'histogram',
 *   {field: 'amount'}
 * );
 *
 * if (error) {
 *   console.error('Chart spec generation failed:', error.message);
 * } else if (renderableSpec) {
 *   // Use renderableSpec with Mosaic VgPlotChart
 * }
 */
export function useGenerateSpec(
  tableName: string | undefined,
  chartType: VgPlotChartType,
  settings: VgPlotChartSettings | Record<string, unknown>,
): UseGenerateSpecResult {
  return useMemo(() => {
    try {
      const spec = generateMosaicChartSpec(tableName, chartType, settings);

      const renderableSpec = toRenderableMosaicSpec(spec);

      return {
        spec,
        renderableSpec,
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
  }, [tableName, chartType, settings]);
}

function toRenderableMosaicSpec(vgplot: unknown): Spec | undefined {
  try {
    if (!vgplot || typeof vgplot !== 'object' || Array.isArray(vgplot)) {
      return undefined;
    }

    const vgplotRecord = vgplot as Spec;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const {$schema, ...mosaicSpec} = vgplotRecord;

    return mosaicSpec;
  } catch (error) {
    console.error('[toRenderableMosaicSpec] Failed to parse spec:', error);
    return undefined;
  }
}
