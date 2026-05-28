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

const CHART_TYPE_ALIASES: Record<string, ChartConfigType['chartType']> = {
  histogram: 'histogram',
  count: 'count-plot',
  countplot: 'count-plot',
  'count-plot': 'count-plot',
  bar: 'count-plot',
  barchart: 'count-plot',
  'bar-chart': 'count-plot',
  line: 'line-chart',
  linechart: 'line-chart',
  'line-chart': 'line-chart',
  heatmap: 'heatmap',
  heat: 'heatmap',
  bubble: 'bubble-chart',
  bubblechart: 'bubble-chart',
  'bubble-chart': 'bubble-chart',
  scatter: 'bubble-chart',
  scatterplot: 'bubble-chart',
  'scatter-plot': 'bubble-chart',
  box: 'box-plot',
  boxplot: 'box-plot',
  'box-plot': 'box-plot',
  custom: 'custom-spec',
  customspec: 'custom-spec',
  'custom-spec': 'custom-spec',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeChartType(value: unknown) {
  if (typeof value !== 'string') return undefined;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');
  return (
    CHART_TYPE_ALIASES[normalized] ??
    CHART_TYPE_ALIASES[normalized.replace(/-/g, '')]
  );
}

function normalizeFieldSettings(
  chartType: ChartConfigType['chartType'],
  settings: Record<string, unknown>,
) {
  const nextSettings = {...settings};
  if (
    (chartType === 'histogram' || chartType === 'count-plot') &&
    typeof nextSettings.field !== 'string'
  ) {
    const field = nextSettings.x ?? nextSettings.column ?? nextSettings.name;
    if (typeof field === 'string') {
      nextSettings.field = field;
    }
  }
  return nextSettings;
}

function candidateFromRecord(
  value: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const chartType = normalizeChartType(
    value.chartType ?? value.chart_type ?? value.type ?? value.kind,
  );
  if (!chartType) return undefined;

  const rawSettings = isRecord(value.settings)
    ? value.settings
    : isRecord(value.options)
      ? value.options
      : {};

  const settings = normalizeFieldSettings(chartType, {
    ...rawSettings,
    ...(typeof value.field === 'string' && !('field' in rawSettings)
      ? {field: value.field}
      : {}),
    ...(typeof value.x === 'string' && !('x' in rawSettings)
      ? {x: value.x}
      : {}),
    ...(typeof value.y === 'string' && !('y' in rawSettings)
      ? {y: value.y}
      : {}),
  });

  return {
    ...value,
    chartType,
    settings,
  };
}

function getCandidateInputs(config: unknown): unknown[] {
  if (!isRecord(config)) return [config];
  return [
    config,
    config.config,
    config.chartConfig,
    config.chart,
    isRecord(config.panel) ? config.panel.config : undefined,
  ].filter((candidate) => candidate !== undefined);
}

export function parseAnalysisChartConfig(
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

  for (const candidate of getCandidateInputs(config)) {
    if (!isRecord(candidate)) continue;
    const normalizedCandidate = candidateFromRecord(candidate);
    if (!normalizedCandidate) continue;
    const normalized = ChartConfig.safeParse(normalizedCandidate);
    if (normalized.success) {
      return {success: true, config: normalized.data, normalized: true};
    }
  }

  return {
    success: false,
    error:
      parsed.error.issues[0]?.message ??
      'The chart block is not a valid Mosaic ChartConfig.',
  };
}
