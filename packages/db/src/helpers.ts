import {CORE_DUCKDB_CONNECTION_ID} from './connectors/duckdb';
import type * as arrow from 'apache-arrow';
import type {DbSliceConfig, RuntimeSupport} from './types';

export function isCoreDuckDbConnection(connectionId: string): boolean {
  return connectionId === CORE_DUCKDB_CONNECTION_ID;
}

export function getCoreDuckDbConnectionId(): string {
  return CORE_DUCKDB_CONNECTION_ID;
}

export function createDefaultDbConfig(
  config?: Partial<DbSliceConfig>,
): DbSliceConfig {
  const coreConnectionId =
    config?.coreConnectionId ?? CORE_DUCKDB_CONNECTION_ID;
  const runtime: RuntimeSupport = config?.currentRuntime ?? 'both';
  return {
    currentRuntime: runtime,
    coreConnectionId,
    coreMaterialization: {
      strategy: 'attached_ephemeral',
      schemaName: '__sqlrooms_external',
      attachedDatabaseName: '__sqlrooms_external_ephemeral',
      ...config?.coreMaterialization,
    },
    connections: {
      [coreConnectionId]: {
        id: coreConnectionId,
        engineId: 'duckdb',
        title: 'Core DuckDB',
        runtimeSupport: 'both',
        requiresBridge: false,
        isCore: true,
      },
      ...(config?.connections ?? {}),
    },
  };
}

export function isRuntimeCompatible(
  current: RuntimeSupport,
  support: RuntimeSupport,
): boolean {
  return support === 'both' || current === support;
}

export function isDuplicateAttachError(
  error: unknown,
  attachedName: string,
): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const message =
    'message' in error && typeof error.message === 'string'
      ? error.message.toLowerCase()
      : '';
  const normalizedAttachedName = attachedName.toLowerCase();
  const duplicateAliasText = `database with name "${normalizedAttachedName}" already exists`;

  return (
    message.includes('already attached') || message.includes(duplicateAliasText)
  );
}

/**
 * Connector shape that can materialize Apache Arrow tables.
 */
export type ArrowMaterializingConnector = {
  loadArrow: (table: arrow.Table, tableName: string) => Promise<unknown>;
};

/**
 * Narrows an unknown connector value to one that supports Arrow materialization.
 */
export function hasLoadArrow(
  connector: unknown,
): connector is ArrowMaterializingConnector {
  return (
    typeof connector === 'object' &&
    connector !== null &&
    'loadArrow' in connector &&
    typeof connector.loadArrow === 'function'
  );
}
