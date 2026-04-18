import type {SqlroomsDeckLayerProps} from '../types';

function hasSqlroomsKeys(props: Record<string, unknown>) {
  return (
    'sqlroomsData' in props ||
    'sqlroomsGeometryColumn' in props ||
    'sqlroomsGeometryEncodingHint' in props
  );
}

export function resolveSqlroomsDatasetId(
  props: Record<string, unknown>,
  datasetIds: string[],
) {
  const sqlroomsProps = props as SqlroomsDeckLayerProps & {data?: unknown};
  if (typeof sqlroomsProps.sqlroomsData === 'string' && sqlroomsProps.sqlroomsData) {
    return sqlroomsProps.sqlroomsData;
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
  return hasSqlroomsKeys(props) || resolveSqlroomsDatasetId(props, datasetIds) != null;
}

export function stripSqlroomsLayerProps(props: Record<string, unknown>) {
  const nextProps = {...props};
  delete nextProps.sqlroomsData;
  delete nextProps.sqlroomsGeometryColumn;
  delete nextProps.sqlroomsGeometryEncodingHint;
  return nextProps;
}
