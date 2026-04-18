import type {PreparedDeckDatasetState, SqlroomsDeckLayerProps} from '../types';
import {
  buildSqlroomsColorScaleLegend,
  type SqlroomsResolvedColorLegend,
} from './compileSqlroomsColorScale';
import {
  resolveSqlroomsColorLegend,
  resolveSqlroomsColorScale,
  resolveSqlroomsDatasetId,
} from './isSqlroomsManagedLayer';

function resolveLegendTitle(
  layerProps: Record<string, unknown>,
  fallbackField: string,
) {
  const legend = resolveSqlroomsColorLegend(layerProps);
  if (
    legend &&
    typeof legend === 'object' &&
    typeof legend.title === 'string'
  ) {
    return legend.title;
  }

  if (typeof layerProps.id === 'string' && layerProps.id.trim()) {
    return layerProps.id;
  }

  return fallbackField;
}

export function extractSqlroomsColorScaleLegends(options: {
  spec: Record<string, unknown> | null;
  datasetIds: string[];
  datasetStates: Record<string, PreparedDeckDatasetState>;
}) {
  const {spec, datasetIds, datasetStates} = options;
  if (!spec || !Array.isArray(spec.layers)) {
    return [] as SqlroomsResolvedColorLegend[];
  }

  const legends: SqlroomsResolvedColorLegend[] = [];

  for (const layer of spec.layers) {
    if (!layer || typeof layer !== 'object') {
      continue;
    }

    const layerProps = layer as Record<string, unknown>;
    const sqlroomsProps = layerProps as SqlroomsDeckLayerProps &
      Record<string, unknown>;
    const colorScale = resolveSqlroomsColorScale(sqlroomsProps);
    const legend = resolveSqlroomsColorLegend(sqlroomsProps);
    if (!colorScale || legend === false) {
      continue;
    }

    const datasetId = resolveSqlroomsDatasetId(layerProps, datasetIds);
    if (!datasetId) {
      continue;
    }

    const datasetState = datasetStates[datasetId];
    if (!datasetState || datasetState.status !== 'ready') {
      continue;
    }

    const resolvedLegend = buildSqlroomsColorScaleLegend({
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
