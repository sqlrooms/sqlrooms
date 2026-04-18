import type {SqlroomsDeckLayerProps} from '../types';

function hasSqlroomsKeys(props: Record<string, unknown>) {
  return '_sqlrooms' in props;
}

function getSqlroomsConfig(props: Record<string, unknown>) {
  const sqlroomsProps = props as SqlroomsDeckLayerProps & {data?: unknown};
  if (!sqlroomsProps._sqlrooms || typeof sqlroomsProps._sqlrooms !== 'object') {
    return undefined;
  }

  return sqlroomsProps._sqlrooms;
}

export function resolveSqlroomsDatasetId(
  props: Record<string, unknown>,
  datasetIds: string[],
) {
  const sqlroomsProps = props as SqlroomsDeckLayerProps & {data?: unknown};
  const config = getSqlroomsConfig(props);
  if (typeof config?.dataset === 'string' && config.dataset) {
    return config.dataset;
  }

  if (datasetIds.length === 1 && sqlroomsProps.data === undefined) {
    return datasetIds[0];
  }

  return undefined;
}

export function isSqlroomsManagedLayer(
  props: Record<string, unknown>,
  datasetIds: string[],
) {
  return (
    hasSqlroomsKeys(props) ||
    resolveSqlroomsDatasetId(props, datasetIds) != null
  );
}

export function stripSqlroomsLayerProps(props: Record<string, unknown>) {
  const nextProps = {...props};
  delete nextProps._sqlrooms;
  return nextProps;
}

export function resolveSqlroomsGeometryColumn(props: Record<string, unknown>) {
  const config = getSqlroomsConfig(props);
  return typeof config?.geometryColumn === 'string' && config.geometryColumn
    ? config.geometryColumn
    : undefined;
}
