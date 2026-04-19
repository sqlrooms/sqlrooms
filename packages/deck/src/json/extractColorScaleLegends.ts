import type {ResolvedColorLegend} from '@sqlrooms/color-scales';
import type {LayerExtensionProps, PreparedDeckDatasetState} from '../types';
import {buildColorScaleLegend} from './compileColorScale';
import {
  resolveColorLegend,
  resolveColorScale,
  resolveDatasetId,
} from './layerConfig';

function resolveLegendTitle(
  layerProps: Record<string, unknown>,
  fallbackField: string,
) {
  const legend = resolveColorLegend(layerProps);
  if (
    legend &&
    typeof legend === 'object' &&
    typeof legend.title === 'string'
  ) {
    return legend.title;
  }

  return fallbackField;
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
    const extensionProps = layerProps as LayerExtensionProps &
      Record<string, unknown>;
    const colorScale = resolveColorScale(extensionProps);
    if (!colorScale) {
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

    const resolvedLegend = buildColorScaleLegend({
      table: datasetState.prepared.table,
      colorScale,
      title: resolveLegendTitle(layerProps, colorScale.field),
    });

    if (resolvedLegend) {
      legends.push(resolvedLegend);
    }
  }

  return legends;
}
