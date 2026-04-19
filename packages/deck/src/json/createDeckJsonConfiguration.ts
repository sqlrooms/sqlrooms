import {JSONConfiguration} from '@deck.gl/json';
import {wkbGeometryDecoder} from '../prepare/wkbDecoder';
import type {LayerExtensionProps, PreparedDeckDatasetState} from '../types';
import {compileColorScale} from './compileColorScale';
import {
  DEFAULT_DECK_JSON_CLASSES,
  DEFAULT_DECK_JSON_CONSTANTS,
  DEFAULT_DECK_JSON_ENUMERATIONS,
} from './defaultClasses';
import {
  getLayerCompatibility,
  isSupportedGeoArrowLayerType,
} from './layerCompatibility';
import {
  isManagedLayer,
  resolveColorScale,
  resolveColorScaleProp,
  resolveDatasetId,
  resolveGeometryColumn,
  stripLayerExtensionProps,
} from './layerConfig';
import {rewriteGeoArrowAccessors} from './rewriteGeoArrowAccessors';

type CreateDeckJsonConfigurationOptions = {
  datasetStates: Record<string, PreparedDeckDatasetState>;
  datasetIds: string[];
};

function getLayerName(Class: unknown) {
  const maybeClass = Class as {layerName?: string; name?: string};
  return maybeClass.layerName ?? maybeClass.name ?? 'UnknownLayer';
}

function applyColorScale(options: {
  props: Record<string, unknown>;
  layerProps: LayerExtensionProps & Record<string, unknown>;
  table: import('apache-arrow').Table;
}) {
  const {props, layerProps, table} = options;
  const colorScale = resolveColorScale(layerProps);
  if (!colorScale) {
    return props;
  }

  const targetProp = resolveColorScaleProp(layerProps) ?? 'getFillColor';
  if (props[targetProp] !== undefined) {
    return props;
  }

  const updateTriggers =
    props.updateTriggers &&
    typeof props.updateTriggers === 'object' &&
    !Array.isArray(props.updateTriggers)
      ? (props.updateTriggers as Record<string, unknown>)
      : {};

  return {
    ...props,
    [targetProp]: compileColorScale({
      table,
      colorScale,
    }),
    updateTriggers: {
      ...updateTriggers,
      [targetProp]: JSON.stringify(colorScale),
    },
  };
}

export function createDeckJsonConfiguration(
  options: CreateDeckJsonConfigurationOptions,
) {
  const {datasetStates, datasetIds} = options;

  return new JSONConfiguration({
    classes: DEFAULT_DECK_JSON_CLASSES,
    enumerations: DEFAULT_DECK_JSON_ENUMERATIONS,
    constants: DEFAULT_DECK_JSON_CONSTANTS,
    // TODO(geoarrow-upgrade): In 0.3.x we preserve raw `@@=` strings here because
    // `@deck.gl/json` would otherwise eagerly compile them into row-based accessors
    // before `preProcessClassProps` can rewrite them for GeoArrow. If the next
    // GeoArrow version can consume deck.gl/json's converted accessors directly, or
    // exposes a cleaner injection seam, remove this shim.
    convertFunction: (expression: string) => `@@=${expression}`,
    preProcessClassProps: (Class: unknown, props: unknown) => {
      const layerName = getLayerName(Class);
      const compatibility = getLayerCompatibility(layerName);

      if (!compatibility) {
        return props;
      }

      const layerProps = props as Record<string, unknown>;
      const extensionProps = layerProps as typeof layerProps &
        LayerExtensionProps;
      const datasetId = resolveDatasetId(extensionProps, datasetIds);
      const managed =
        isManagedLayer(extensionProps, datasetIds) ||
        (datasetIds.length > 1 && layerProps.data === undefined);

      if (!managed) {
        return props;
      }

      if (!datasetId) {
        throw new Error(
          `Layer "${layerName}" must declare _sqlrooms.dataset when multiple datasets are available.`,
        );
      }

      const datasetState = datasetStates[datasetId];
      if (!datasetState) {
        throw new Error(
          `Layer "${layerName}" references unknown dataset "${datasetId}".`,
        );
      }

      if (datasetState.status !== 'ready') {
        return stripLayerExtensionProps(layerProps);
      }

      const prepared = datasetState.prepared;
      const geometryColumn = resolveGeometryColumn(extensionProps);
      const baseProps = applyColorScale({
        props: stripLayerExtensionProps(layerProps),
        layerProps: extensionProps,
        table: prepared.table,
      });

      if (compatibility.representation === 'geojson') {
        return {
          ...baseProps,
          data: prepared.getGeoJsonBinaryData(geometryColumn),
        };
      }

      const resolvedGeometry = prepared.resolveGeometry(geometryColumn);
      if (
        !resolvedGeometry.nativeGeoArrow &&
        !(
          isSupportedGeoArrowLayerType(layerName) &&
          wkbGeometryDecoder.supportsGeoArrowPromotion(
            layerName,
            resolvedGeometry.encoding,
            prepared.table,
            resolvedGeometry.columnName,
          )
        )
      ) {
        throw new Error(
          `Layer "${layerName}" cannot render geometry encoding "${resolvedGeometry.encoding}" for dataset "${datasetId}".`,
        );
      }

      const geoArrowLayerData = prepared.getGeoArrowLayerData(geometryColumn);
      const nextProps = {
        ...baseProps,
        // TODO(geoarrow-upgrade): 0.3.x expects `data` as an Arrow Table and the
        // geometry accessor as an Arrow Vector. Re-check this payload contract when
        // upgrading; newer GeoArrow code may prefer RecordBatch/Data chunks instead.
        data: geoArrowLayerData.table,
        [compatibility.geometryProp]:
          baseProps[compatibility.geometryProp] ??
          geoArrowLayerData.geometryColumn,
      };

      return rewriteGeoArrowAccessors({
        props: nextProps,
        table: geoArrowLayerData.table,
        layerName,
      });
    },
    postProcessConvertedJson: (json: unknown) => {
      if (
        json &&
        typeof json === 'object' &&
        'layers' in json &&
        Array.isArray((json as {layers?: unknown[]}).layers)
      ) {
        (json as {layers: unknown[]}).layers = (
          json as {layers: unknown[]}
        ).layers.filter(Boolean);
      }

      return json;
    },
  });
}
