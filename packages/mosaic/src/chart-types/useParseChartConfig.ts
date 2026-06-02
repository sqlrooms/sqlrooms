import {useMemo} from 'react';
import {ChartConfig} from './chart-config';
import {HistogramChartConfig} from './histogram/schema';

const DEFAULT_CHART_CONFIG: HistogramChartConfig = {
  chartType: 'histogram',
  settings: {},
  settingsOpen: true,
};

type ChartConfigParseResult =
  | {
      success: true;
      config: ChartConfig;
    }
  | {
      success: false;
      error: string;
    };

export function useParseChartConfig(
  config: unknown,
  defaultConfig: ChartConfig = DEFAULT_CHART_CONFIG,
): ChartConfigParseResult {
  return useMemo(
    () => parseChartConfig(config, defaultConfig),
    [config, defaultConfig],
  );
}

export function parseChartConfig(
  config: unknown,
  defaultConfig?: ChartConfig,
): ChartConfigParseResult {
  const parsed = ChartConfig.safeParse(
    config && !isPlainEmptyObject(config) ? config : defaultConfig,
  );

  if (parsed.success) {
    return {success: true, config: parsed.data};
  }

  return {
    success: false,
    error:
      parsed.error.issues[0]?.message ??
      'The chart is not a valid Mosaic ChartConfig.',
  };
}

function isPlainEmptyObject(value: unknown): value is Record<string, never> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 0
  );
}
