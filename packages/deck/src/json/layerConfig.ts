import type {ColorLegendConfig, ColorScaleConfig} from '@sqlrooms/color-scales';
import type {
  LayerBindingConfig,
  LayerBindingProps,
  SqlroomsColorScaleFunction,
} from '../DeckJsonMapSpec';

function hasExtensionKeys(props: Record<string, unknown>) {
  return '_sqlroomsBinding' in props;
}

function getLayerConfig(props: Record<string, unknown>) {
  const layerProps = props as LayerBindingProps & {data?: unknown};
  if (
    !layerProps._sqlroomsBinding ||
    typeof layerProps._sqlroomsBinding !== 'object'
  ) {
    return undefined;
  }

  return layerProps._sqlroomsBinding;
}

export type LayerConfigColumnKey = keyof Pick<
  LayerBindingConfig,
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
  const layerProps = props as LayerBindingProps & {data?: unknown};
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
  delete nextProps._sqlroomsBinding;
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

export function isSqlroomsColorScaleFunction(
  value: unknown,
): value is SqlroomsColorScaleFunction {
  return Boolean(
    value &&
    typeof value === 'object' &&
    (value as {'@@function'?: unknown})['@@function'] === 'sqlroomsColorScale',
  );
}

export function resolveColorScale(
  props: Record<string, unknown>,
  key?: string,
): ColorScaleConfig | undefined {
  const value = key ? props[key] : undefined;
  return isSqlroomsColorScaleFunction(value) ? value : undefined;
}

export function resolveColorLegend(
  props: Record<string, unknown>,
  key?: string,
): ColorLegendConfig | undefined {
  return resolveColorScale(props, key)?.legend;
}
