import {createWebSocketDuckDbConnector} from '@sqlrooms/duckdb';

import {addCliDatabaseInitializationDiagnostics} from './cliDatabaseInitialization';
import {runtimeConfig} from './runtimeEnvironment';

export const MOSAIC_PREAGG_DATABASE = '__sqlrooms_mosaic_cache';
export const MOSAIC_PREAGG_SCHEMA = 'mosaic';
export const MOSAIC_PREAGG_SCHEMA_REF = `${MOSAIC_PREAGG_DATABASE}.${MOSAIC_PREAGG_SCHEMA}`;

/** WebSocket URL used by the CLI DuckDB runtime. */
export const cliDuckDbWsUrl = runtimeConfig.wsUrl || 'ws://localhost:4000';

/** DuckDB connector shared by the CLI store and connection-status UI. */
export const cliDuckDbConnector = createWebSocketDuckDbConnector({
  wsUrl: cliDuckDbWsUrl,
  authToken: runtimeConfig.wsAuthToken,
  initializationQuery: [
    'INSTALL spatial',
    'LOAD spatial',
    `ATTACH IF NOT EXISTS ':memory:' AS ${MOSAIC_PREAGG_DATABASE}`,
    `CREATE SCHEMA IF NOT EXISTS ${MOSAIC_PREAGG_SCHEMA_REF}`,
  ].join('; '),
});

addCliDatabaseInitializationDiagnostics(cliDuckDbConnector, {
  runtimeConfig,
  wsUrl: cliDuckDbWsUrl,
  authToken: runtimeConfig.wsAuthToken,
});
