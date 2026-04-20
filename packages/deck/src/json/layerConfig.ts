import type {ColorLegendConfig, ColorScaleConfig} from '@sqlrooms/color-scales';
import type {
  DeckColorScaleProp,
  LayerExtensionConfig,
  LayerExtensionProps,
} from '../DeckJsonMapSpec';

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

export type LayerConfigColumnKey = keyof Pick<
  LayerExtensionConfig,
  | 'geometryColumn'
  | 'sourceGeometryColumn'
  | 'targetGeometryColumn'
  | 'timestampColumn'
  | 'hexagonColumn'
>;

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

export function resolveConfiguredColumn(
  props: Record<string, unknown>,
  key: LayerConfigColumnKey,
) {
  const config = getLayerConfig(props);
  const value = config?.[key];
  return typeof value === 'string' && value ? value : undefined;
}

export function resolveColorScale(
  props: Record<string, unknown>,
): ColorScaleConfig | undefined {
  const config = getLayerConfig(props);
  return config?.colorScale;
}

export function resolveColorLegend(
  props: Record<string, unknown>,
): ColorLegendConfig | undefined {
  return resolveColorScale(props)?.legend;
}

export function resolveColorScaleProp(
  props: Record<string, unknown>,
): DeckColorScaleProp | undefined {
  const config = getLayerConfig(props);
  return config?.colorScaleProp;
}
