import {JSONConfiguration} from '@deck.gl/json';
import * as arrow from 'apache-arrow';
import type {ColorScaleConfig} from '@sqlrooms/color-scales';
import {
  continuousSequentialInterpolators,
  parseColorString,
} from '@sqlrooms/color-scales';
import {wkbGeometryDecoder} from '../prepare/wkbDecoder';
import {tryAggregateWaypointsToLineStrings} from './aggregateWaypoints';
import type {LayerBindingProps, PreparedDeckDatasetState} from '../types';
import {createColorScaleMarker, getColorScale} from './colorScaleFunction';
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

type CreateDeckJsonConfigurationOptions = {
  datasetStates: Record<string, PreparedDeckDatasetState>;
  datasetIds: string[];
};

const HEATMAP_COLOR_STEPS = 6;
const DEFAULT_HEATMAP_COLOR_RANGE: Array<[number, number, number, number]> =
  continuousSequentialInterpolators.YlOrRd
    ? Array.from({length: HEATMAP_COLOR_STEPS}, (_, i) =>
        parseColorString(
          continuousSequentialInterpolators.YlOrRd(
            i / (HEATMAP_COLOR_STEPS - 1),
          ),
        ),
      )
    : [
        [255, 255, 178, 255],
        [254, 178, 76, 255],
        [253, 141, 60, 255],
        [240, 59, 32, 255],
        [189, 0, 38, 255],
        [128, 0, 38, 255],
      ];

function getLayerName(Class: unknown) {
  const maybeClass = Class as {layerName?: string; name?: string};
  return maybeClass.layerName ?? maybeClass.name ?? 'UnknownLayer';
}

function applyColorScale(options: {
  props: Record<string, unknown>;
  table: import('apache-arrow').Table;
}) {
  const {props, table} = options;
  const resolved = getColorScale(props);
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

      let resolvedGeometry;
      try {
        resolvedGeometry = prepared.resolveGeometry(columnName);
      } catch {
        throw new Error(
          `Geometry column "${columnName}" was not found in dataset "${prepared.datasetId}".`,
        );
      }

      // Detect mismatch: synthesized points can't satisfy a LineString binding.
      // For PathLayer, try auto-aggregating waypoint rows into linestrings.
      if (
        resolvedGeometry.encoding === 'geoarrow.point' &&
        binding.prop === 'getPath'
      ) {
        const aggregated = tryAggregateWaypointsToLineStrings(prepared.table);
        if (aggregated) {
          table = aggregated.table;
          boundProps[binding.prop] = aggregated.geometryVector;
          continue;
        }
        const available = prepared.table.schema.fields
          .map((f) => f.name)
          .join(', ');
        throw new Error(
          `Layer "${layerName}" requires LineString geometry for getPath, ` +
            `but only point coordinates were found and auto-aggregation failed. ` +
            `The dataset sqlQuery must aggregate rows into linestrings using ST_MakeLine. ` +
            `Available columns: ${available}.`,
        );
      }
      if (
        resolvedGeometry.encoding === 'geoarrow.point' &&
        binding.prop === 'getPolygon'
      ) {
        const available = prepared.table.schema.fields
          .map((f) => f.name)
          .join(', ');
        throw new Error(
          `Layer "${layerName}" requires Polygon geometry for ${binding.prop}, ` +
            `but only point coordinates were found. Available columns: ${available}.`,
        );
      }
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
      if (layerData.source === 'promoted') {
        boundProps[binding.prop] = layerData.geometryColumn;
        if (table === prepared.table) {
          table = layerData.table;
        }
      } else {
        if (table !== prepared.table && table !== layerData.table) {
          throw new Error(
            `Layer "${layerName}" cannot combine promoted geometry columns from different prepared tables.`,
          );
        }
        table = layerData.table;
        boundProps[binding.prop] = layerData.geometryColumn;
      }
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
      colorScale: (props: ColorScaleConfig) => createColorScaleMarker(props),
      scale: (props: Record<string, unknown>) => {
        const field = typeof props.field === 'string' ? props.field : undefined;
        if (!field) return undefined;
        return `@@=${field}`;
      },
    },
    // TODO(geoarrow-upgrade): In 0.3.x we preserve raw `@@=` strings here because
    // `@deck.gl/json` would otherwise eagerly compile them into row-based accessors
    // before `preProcessClassProps` can rewrite them for GeoArrow. If the next
    // GeoArrow version can consume deck.gl/json's converted accessors directly, or
    // exposes a cleaner injection seam, remove this shim.
    convertFunction: ((expression: string) => `@@=${expression}`) as never,
    preProcessClassProps: (Class: unknown, props: Record<string, unknown>) => {
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
        return {...stripLayerExtensionProps(layerProps), data: []};
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
        compatibility: compatibility as NonNullable<
          ReturnType<typeof getLayerCompatibility>
        > & {representation: 'geoarrow'},
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

      const rewritten = rewriteGeoArrowAccessors({
        props: nextProps,
        table,
        layerName,
      });

      // For TripsLayer: compute max timestamp for animation and set defaults
      if (layerName === 'GeoArrowTripsLayer' || layerName === 'TripsLayer') {
        const tsVector = boundProps.getTimestamps as arrow.Vector | undefined;
        if (tsVector) {
          let maxTs = 0;
          for (let i = 0; i < tsVector.length; i++) {
            const listItem = tsVector.get(i);
            if (
              listItem &&
              typeof listItem === 'object' &&
              'length' in listItem
            ) {
              const list = listItem as {
                length: number;
                get: (i: number) => unknown;
              };
              for (let j = 0; j < list.length; j++) {
                const v = Number(list.get(j)) || 0;
                if (v > maxTs) maxTs = v;
              }
            }
          }
          if (maxTs > 0) {
            rewritten._tripsMaxTimestamp = maxTs;
            if (!rewritten.trailLength) {
              rewritten.trailLength = maxTs;
            }
            if (
              rewritten.currentTime === undefined ||
              rewritten.currentTime === 0
            ) {
              rewritten.currentTime = maxTs;
            }
          }
        }
      }

      // For HeatmapLayer: apply default colorRange (YlOrRd) when not explicitly set.
      // Also set updateTriggers to force re-aggregation when colorRange changes.
      if (
        layerName === 'GeoArrowHeatmapLayer' ||
        layerName === 'HeatmapLayer'
      ) {
        if (!rewritten.colorRange) {
          rewritten.colorRange = DEFAULT_HEATMAP_COLOR_RANGE;
        }
        const existingTriggers =
          rewritten.updateTriggers &&
          typeof rewritten.updateTriggers === 'object' &&
          !Array.isArray(rewritten.updateTriggers)
            ? (rewritten.updateTriggers as Record<string, unknown>)
            : {};
        rewritten.updateTriggers = {
          ...existingTriggers,
          getWeight: JSON.stringify(rewritten.colorRange),
        };
      }

      return rewritten;
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
