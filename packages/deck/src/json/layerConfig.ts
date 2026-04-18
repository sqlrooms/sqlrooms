import type {
  LayerColorLegendConfig,
  LayerColorScale,
  LayerExtensionProps,
} from '../types';

function hasExtensionKeys(props: Record<string, unknown>) {
  return '_sqlrooms' in props;
}

function getLayerConfig(props: Record<string, unknown>) {
  const layerProps = props as LayerExtensionProps & {data?: unknown};
  if (!layerProps._sqlrooms || typeof layerProps._sqlrooms !== 'object') {
    return undefined;
  }

  return layerProps._sqlrooms;
}

export function resolveDatasetId(
  props: Record<string, unknown>,
  datasetIds: string[],
) {
  const layerProps = props as LayerExtensionProps & {data?: unknown};
  const config = getLayerConfig(props);
  if (typeof config?.dataset === 'string' && config.dataset) {
    return config.dataset;
  }

  if (datasetIds.length === 1 && layerProps.data === undefined) {
    return datasetIds[0];
  }

  return undefined;
}

export function isManagedLayer(
  props: Record<string, unknown>,
  datasetIds: string[],
) {
  return hasExtensionKeys(props) || resolveDatasetId(props, datasetIds) != null;
}

export function stripLayerExtensionProps(props: Record<string, unknown>) {
  const nextProps = {...props};
  delete nextProps._sqlrooms;
  return nextProps;
}

export function resolveGeometryColumn(props: Record<string, unknown>) {
  const config = getLayerConfig(props);
  return typeof config?.geometryColumn === 'string' && config.geometryColumn
    ? config.geometryColumn
    : undefined;
}

export function resolveColorScale(
  props: Record<string, unknown>,
): LayerColorScale | undefined {
  const config = getLayerConfig(props);
  return config?.colorScale;
}

export function resolveColorLegend(
  props: Record<string, unknown>,
): LayerColorLegendConfig | undefined {
  return resolveColorScale(props)?.legend;
}
