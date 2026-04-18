import {JSONConfiguration} from '@deck.gl/json';
import type {PreparedDeckDatasetState, SqlroomsDeckLayerProps} from '../types';
import {DEFAULT_DECK_JSON_CLASSES, DEFAULT_DECK_JSON_CONSTANTS, DEFAULT_DECK_JSON_ENUMERATIONS} from './defaultClasses';
import {getLayerCompatibility, isSupportedGeoArrowLayerType} from './layerCompatibility';
import {
  isSqlroomsManagedLayer,
  resolveSqlroomsDatasetId,
  stripSqlroomsLayerProps,
} from './isSqlroomsManagedLayer';
import {rewriteGeoArrowAccessors} from './rewriteGeoArrowAccessors';
import {wkbGeometryDecoder} from '../prepare/wkbDecoder';

type CreateDeckJsonConfigurationOptions = {
  datasetStates: Record<string, PreparedDeckDatasetState>;
  datasetIds: string[];
};

function getLayerName(Class: unknown) {
  const maybeClass = Class as {layerName?: string; name?: string};
  return maybeClass.layerName ?? maybeClass.name ?? 'UnknownLayer';
}

export function createDeckJsonConfiguration(
  options: CreateDeckJsonConfigurationOptions,
) {
  const {datasetStates, datasetIds} = options;

  return new JSONConfiguration({
    classes: DEFAULT_DECK_JSON_CLASSES,
    enumerations: DEFAULT_DECK_JSON_ENUMERATIONS,
    constants: DEFAULT_DECK_JSON_CONSTANTS,
    preProcessClassProps: (Class: unknown, props: unknown) => {
      const layerName = getLayerName(Class);
      const compatibility = getLayerCompatibility(layerName);

      if (!compatibility) {
        return props;
      }

      const layerProps = props as Record<string, unknown>;
      const sqlroomsProps = layerProps as typeof layerProps & SqlroomsDeckLayerProps;
      const datasetId = resolveSqlroomsDatasetId(sqlroomsProps, datasetIds);
      const managed =
        isSqlroomsManagedLayer(sqlroomsProps, datasetIds) ||
        (datasetIds.length > 1 && layerProps.data === undefined);

      if (!managed) {
        return props;
      }

      if (!datasetId) {
        throw new Error(
          `Layer "${layerName}" must declare sqlroomsData when multiple datasets are available.`,
        );
      }

      const datasetState = datasetStates[datasetId];
      if (!datasetState) {
        throw new Error(`Layer "${layerName}" references unknown dataset "${datasetId}".`);
      }

      if (datasetState.status !== 'ready') {
        return stripSqlroomsLayerProps(layerProps);
      }

      const prepared = datasetState.prepared;
      const geometryColumn = sqlroomsProps.sqlroomsGeometryColumn;
      const baseProps = stripSqlroomsLayerProps(layerProps);

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
        data: geoArrowLayerData.table,
        [compatibility.geometryProp]:
          baseProps[compatibility.geometryProp] ?? geoArrowLayerData.geometryColumn,
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
        (json as {layers: unknown[]}).layers = (json as {layers: unknown[]}).layers.filter(
          Boolean,
        );
      }

      return json;
    },
  });
}
