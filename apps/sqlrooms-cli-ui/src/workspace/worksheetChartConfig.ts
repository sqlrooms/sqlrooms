import {
  ChartConfig,
  type ChartConfig as ChartConfigType,
} from '@sqlrooms/mosaic';

type ChartConfigParseResult =
  | {
      success: true;
      config: ChartConfigType;
      normalized: boolean;
    }
  | {
      success: false;
      error: string;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

export function parseWorksheetChartConfig(
  config: unknown,
  fallbackConfig?: ChartConfigType,
): ChartConfigParseResult {
  const parsed = ChartConfig.safeParse(config);
  if (parsed.success) {
    return {success: true, config: parsed.data, normalized: false};
  }

  if (fallbackConfig && isRecord(config) && Object.keys(config).length === 0) {
    return {success: true, config: fallbackConfig, normalized: true};
  }

  return {
    success: false,
    error:
      parsed.error.issues[0]?.message ??
      'The chart block is not a valid Mosaic ChartConfig.',
  };
}
