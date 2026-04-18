import {JSONConfiguration} from '@deck.gl/json';
import type {PreparedDeckDatasetState, SqlroomsDeckLayerProps} from '../types';
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
  isSqlroomsManagedLayer,
  resolveSqlroomsColorScale,
  resolveSqlroomsDatasetId,
  resolveSqlroomsGeometryColumn,
  stripSqlroomsLayerProps,
} from './isSqlroomsManagedLayer';
import {rewriteGeoArrowAccessors} from './rewriteGeoArrowAccessors';
import {wkbGeometryDecoder} from '../prepare/wkbDecoder';
import {compileSqlroomsColorScale} from './compileSqlroomsColorScale';

type CreateDeckJsonConfigurationOptions = {
  datasetStates: Record<string, PreparedDeckDatasetState>;
  datasetIds: string[];
};

function getLayerName(Class: unknown) {
  const maybeClass = Class as {layerName?: string; name?: string};
  return maybeClass.layerName ?? maybeClass.name ?? 'UnknownLayer';
}

function applySqlroomsColorScale(options: {
  props: Record<string, unknown>;
  sqlroomsProps: SqlroomsDeckLayerProps & Record<string, unknown>;
  table: import('apache-arrow').Table;
}) {
  const {props, sqlroomsProps, table} = options;
  const colorScale = resolveSqlroomsColorScale(sqlroomsProps);
  if (!colorScale) {
    return props;
  }

  const targetProp = colorScale.prop ?? 'getFillColor';
  if (props[targetProp] !== undefined) {
    return props;
  }

  return {
    ...props,
    [targetProp]: compileSqlroomsColorScale({
      table,
      colorScale,
    }),
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
      const sqlroomsProps = layerProps as typeof layerProps &
        SqlroomsDeckLayerProps;
      const datasetId = resolveSqlroomsDatasetId(sqlroomsProps, datasetIds);
      const managed =
        isSqlroomsManagedLayer(sqlroomsProps, datasetIds) ||
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
        return stripSqlroomsLayerProps(layerProps);
      }

      const prepared = datasetState.prepared;
      const geometryColumn = resolveSqlroomsGeometryColumn(sqlroomsProps);
      const baseProps = applySqlroomsColorScale({
        props: stripSqlroomsLayerProps(layerProps),
        sqlroomsProps,
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
