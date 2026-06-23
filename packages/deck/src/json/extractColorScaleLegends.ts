import type {ResolvedColorLegend} from '@sqlrooms/color-scales';
import type {PreparedDeckDatasetState} from '../types';
import {getColorScale} from './colorScaleFunction';
import {buildColorScaleLegend} from './compileColorScale';
import {DEFAULT_HEATMAP_COLOR_RANGE} from './heatmapDefaults';
import {resolveColorLegend, resolveDatasetId} from './layerConfig';

function resolveLegendTitle(
  layerProps: Record<string, unknown>,
  fallbackField: string,
) {
  const legend =
    resolveColorLegend(layerProps, 'getFillColor') ??
    resolveColorLegend(layerProps, 'getLineColor');
  if (
    legend &&
    typeof legend === 'object' &&
    typeof legend.title === 'string'
  ) {
    return legend.title;
  }

  return fallbackField;
}

function buildHeatmapLegend(
  layerProps: Record<string, unknown>,
): ResolvedColorLegend | null {
  const rawRange = layerProps.colorRange as
    | Array<[number, number, number, number]>
    | undefined;
  const colorRange =
    Array.isArray(rawRange) && rawRange.length >= 2
      ? rawRange
      : DEFAULT_HEATMAP_COLOR_RANGE;

  const stops = colorRange.map((c, i) => {
    const pct = (i / (colorRange.length - 1)) * 100;
    return `rgba(${c[0]},${c[1]},${c[2]},${(c[3] ?? 255) / 255}) ${pct.toFixed(1)}%`;
  });

  return {
    type: 'continuous',
    title: 'Density',
    gradient: `linear-gradient(to right, ${stops.join(', ')})`,
    ticks: [
      {label: 'Low', offset: 0},
      {label: 'High', offset: 100},
    ],
  };
}

export function extractColorScaleLegends(options: {
  spec: Record<string, unknown> | null;
  datasetIds: string[];
  datasetStates: Record<string, PreparedDeckDatasetState>;
}) {
  const {spec, datasetIds, datasetStates} = options;
  if (!spec || !Array.isArray(spec.layers)) {
    return [] as ResolvedColorLegend[];
  }

  const legends: ResolvedColorLegend[] = [];

  for (const layer of spec.layers) {
    if (!layer || typeof layer !== 'object') {
      continue;
    }

    const layerProps = layer as Record<string, unknown>;

    if (layerProps.visible === false) {
      continue;
    }

    const layerType = String(layerProps['@@type'] ?? '').toLowerCase();
    if (layerType.includes('heatmap')) {
      const heatmapLegend = buildHeatmapLegend(layerProps);
      if (heatmapLegend) {
        legends.push(heatmapLegend);
      }
      continue;
    }

    const resolvedColorScale = getColorScale(layerProps);
    if (!resolvedColorScale) {
      continue;
    }
    const {colorScale} = resolvedColorScale;

    const datasetId = resolveDatasetId(layerProps, datasetIds);
    if (!datasetId) {
      continue;
    }

    const datasetState = datasetStates[datasetId];
    if (!datasetState || datasetState.status !== 'ready') {
      continue;
    }

    let resolvedLegend: ResolvedColorLegend | null = null;
    try {
      resolvedLegend = buildColorScaleLegend({
        table: datasetState.prepared.table,
        colorScale,
        title: resolveLegendTitle(layerProps, colorScale.field),
      });
    } catch {
      // Skip legends for fields that don't exist in the dataset
      continue;
    }

    if (resolvedLegend) {
      legends.push(resolvedLegend);
    }
  }

  return legends;
}
