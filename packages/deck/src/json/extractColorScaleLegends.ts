import type {ResolvedColorLegend} from '@sqlrooms/color-scales';
import type {PreparedDeckDatasetState} from '../types';
import {getAllColorScales} from './colorScaleFunction';
import {buildColorScaleLegend} from './compileColorScale';
import {DEFAULT_HEATMAP_COLOR_RANGE} from './heatmapDefaults';
import {resolveColorLegend, resolveDatasetId} from './layerConfig';

import type {ColorScalePropName} from './colorScaleFunction';

function resolveLegendTitle(
  layerProps: Record<string, unknown>,
  propName: ColorScalePropName,
  fallbackField: string,
) {
  const legend = resolveColorLegend(layerProps, propName);
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

    const layerType = layerProps['@@type'];
    if (layerType === 'GeoArrowHeatmapLayer') {
      const heatmapLegend = buildHeatmapLegend(layerProps);
      if (heatmapLegend) {
        legends.push(heatmapLegend);
      }
      continue;
    }

    const resolvedColorScales = getAllColorScales(layerProps);
    if (resolvedColorScales.length === 0) {
      continue;
    }

    const datasetId = resolveDatasetId(layerProps, datasetIds);
    if (!datasetId) {
      continue;
    }

    const datasetState = datasetStates[datasetId];
    if (!datasetState || datasetState.status !== 'ready') {
      continue;
    }

    // Prefer fill over stroke for legends. Stroke color-scale legends only show
    // when fill has no color scale (avoids duplicate legends on point/polygon).
    const hasFillColorScale = resolvedColorScales.some(
      (entry) => entry.propName === 'getFillColor',
    );
    const primaryScales = hasFillColorScale
      ? resolvedColorScales.filter((entry) => entry.propName !== 'getLineColor')
      : resolvedColorScales;
    const strokeFallbackScales = hasFillColorScale
      ? resolvedColorScales.filter((entry) => entry.propName === 'getLineColor')
      : [];

    // Show a legend for each remaining distinct color-scale accessor on the
    // layer (fill, path color, or arc source/target). Skip duplicates that
    // resolve to the same title/type/scheme/field.
    const seenLegendKeys = new Set<string>();
    const pushLegendsFrom = (scales: typeof resolvedColorScales): number => {
      let added = 0;
      for (const {propName, colorScale} of scales) {
        try {
          const title = resolveLegendTitle(
            layerProps,
            propName,
            colorScale.field,
          );
          const key = [
            title,
            colorScale.type,
            String(colorScale.scheme ?? ''),
            colorScale.field,
            JSON.stringify(colorScale),
          ].join('\0');
          if (seenLegendKeys.has(key)) continue;

          const resolvedLegend = buildColorScaleLegend({
            table: datasetState.prepared.table,
            colorScale,
            title,
          });
          if (resolvedLegend) {
            seenLegendKeys.add(key);
            legends.push(resolvedLegend);
            added += 1;
          }
        } catch {
          // try next accessor
        }
      }
      return added;
    };

    const added = pushLegendsFrom(primaryScales);
    // Fill scale present but failed to resolve (e.g. missing field) → stroke.
    if (added === 0 && strokeFallbackScales.length > 0) {
      pushLegendsFrom(strokeFallbackScales);
    }
  }

  return legends;
}
