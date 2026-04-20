import {JSONConfiguration} from '@deck.gl/json';
import type {ColorScaleConfig} from '@sqlrooms/color-scales';
import {wkbGeometryDecoder} from '../prepare/wkbDecoder';
import type {LayerBindingProps, PreparedDeckDatasetState} from '../types';
import {compileColorScale} from './compileColorScale';
import {
  DEFAULT_DECK_JSON_CLASSES,
  DEFAULT_DECK_JSON_CONSTANTS,
  DEFAULT_DECK_JSON_ENUMERATIONS,
} from './defaultClasses';
import {getLayerCompatibility} from './layerCompatibility';
import {
  isManagedLayer,
  resolveConfiguredColumn,
  resolveDatasetId,
  resolveGeometryColumn,
  stripLayerExtensionProps,
} from './layerConfig';
import {rewriteGeoArrowAccessors} from './rewriteGeoArrowAccessors';
import {
  createSqlroomsColorScaleMarker,
  getSqlroomsColorScale,
} from './sqlroomsColorScaleFunction';

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
  table: import('apache-arrow').Table;
}) {
  const {props, table} = options;
  const resolved = getSqlroomsColorScale(props);
  if (!resolved) {
    return props;
  }

  const {propName, colorScale} = resolved;

  const updateTriggers =
    props.updateTriggers &&
    typeof props.updateTriggers === 'object' &&
    !Array.isArray(props.updateTriggers)
      ? (props.updateTriggers as Record<string, unknown>)
      : {};

  return {
    ...props,
    [propName]: compileColorScale({
      table,
      colorScale,
    }),
    updateTriggers: {
      ...updateTriggers,
      [propName]: JSON.stringify(colorScale),
    },
  };
}

function resolveGeoArrowBindings(options: {
  layerName: string;
  compatibility: NonNullable<ReturnType<typeof getLayerCompatibility>> & {
    representation: 'geoarrow';
  };
  layerProps: LayerBindingProps & Record<string, unknown>;
  prepared: Extract<PreparedDeckDatasetState, {status: 'ready'}>['prepared'];
  props: Record<string, unknown>;
}) {
  const {layerName, compatibility, layerProps, prepared, props} = options;
  let table = prepared.table;
  const boundProps: Record<string, unknown> = {};

  for (const binding of compatibility.bindings) {
    if (props[binding.prop] !== undefined) {
      continue;
    }

    if (binding.kind === 'geometry') {
      const columnName = resolveConfiguredColumn(layerProps, binding.configKey);
      if (binding.required && !columnName) {
        throw new Error(
          `Layer "${layerName}" requires _sqlroomsBinding.${binding.configKey}.`,
        );
      }

      const resolvedGeometry = prepared.resolveGeometry(columnName);
      if (!resolvedGeometry.nativeGeoArrow) {
        if (
          !compatibility.allowGeoArrowPromotion ||
          !wkbGeometryDecoder.supportsGeoArrowPromotion(
            layerName,
            resolvedGeometry.encoding,
            prepared.table,
            resolvedGeometry.columnName,
          )
        ) {
          throw new Error(
            `Layer "${layerName}" cannot render geometry encoding "${resolvedGeometry.encoding}" for dataset "${prepared.datasetId}".`,
          );
        }
      }

      const layerData = prepared.getGeoArrowLayerData(columnName);
      if (table !== prepared.table && table !== layerData.table) {
        throw new Error(
          `Layer "${layerName}" cannot combine promoted geometry columns from different prepared tables.`,
        );
      }

      table = layerData.table;
      boundProps[binding.prop] = layerData.geometryColumn;
      continue;
    }

    const columnName = resolveConfiguredColumn(layerProps, binding.configKey);
    if (!columnName) {
      if (binding.required) {
        throw new Error(
          `Layer "${layerName}" requires _sqlroomsBinding.${binding.configKey}.`,
        );
      }
      continue;
    }

    const vector =
      table.getChild(columnName) ?? prepared.table.getChild(columnName);
    if (!vector) {
      throw new Error(
        `Layer "${layerName}" references unknown column "${columnName}" for ${binding.prop}.`,
      );
    }

    boundProps[binding.prop] = vector;
  }

  return {table, boundProps};
}

export function createDeckJsonConfiguration(
  options: CreateDeckJsonConfigurationOptions,
) {
  const {datasetStates, datasetIds} = options;

  return new JSONConfiguration({
    classes: DEFAULT_DECK_JSON_CLASSES,
    enumerations: DEFAULT_DECK_JSON_ENUMERATIONS,
    constants: DEFAULT_DECK_JSON_CONSTANTS,
    functions: {
      sqlroomsColorScale: (props: ColorScaleConfig) =>
        createSqlroomsColorScaleMarker(props),
    },
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
        LayerBindingProps;
      const datasetId = resolveDatasetId(extensionProps, datasetIds);
      const managed =
        isManagedLayer(extensionProps, datasetIds) ||
        (datasetIds.length > 1 && layerProps.data === undefined);

      if (!managed) {
        return props;
      }

      if (!datasetId) {
        throw new Error(
          `Layer "${layerName}" must declare _sqlroomsBinding.dataset when multiple datasets are available.`,
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
      const strippedProps = stripLayerExtensionProps(layerProps);

      if (compatibility.representation === 'geojson') {
        const baseProps = applyColorScale({
          props: strippedProps,
          table: prepared.table,
        });
        return {
          ...baseProps,
          data: prepared.getGeoJsonBinaryData(geometryColumn),
        };
      }

      const {table, boundProps} = resolveGeoArrowBindings({
        layerName,
        compatibility,
        layerProps: extensionProps,
        prepared,
        props: strippedProps,
      });
      const baseProps = applyColorScale({
        props: strippedProps,
        table,
      });
      const nextProps = {
        ...baseProps,
        data: table,
        ...boundProps,
      };

      return rewriteGeoArrowAccessors({
        props: nextProps,
        table,
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
