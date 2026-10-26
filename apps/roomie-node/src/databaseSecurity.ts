import {escapeVal} from '@sqlrooms/duckdb-core';
import type {NodeDuckDbConnector} from '@sqlrooms/duckdb-node';

/** Lock the shared native instance before exposing connections, including Quack. */
export async function lockAnalyticalDatabase(
  connector: NodeDuckDbConnector,
  exchangeDirectory: string,
  quack: boolean,
) {
  // nanoarrow is preloaded by the connector. JSON supplies the SQL parser;
  // httpfs supplies Quack crypto, but external network/file access stays disabled.
  await connector.execute('LOAD json; LOAD parquet; LOAD icu');
  if (quack)
    await connector.execute(
      'INSTALL quack; LOAD quack; INSTALL httpfs; LOAD httpfs',
    );
  await connector.execute(`
    SELECT count(*) FROM duckdb_secrets();
    SET allowed_directories = [${escapeVal(exchangeDirectory)}];
    SET allowed_paths = [];
    SET allowed_configs = [];
    SET autoinstall_known_extensions = false;
    SET autoload_known_extensions = false;
    SET enable_external_access = false;
    SET lock_configuration = true;
  `);
  const rows = await connector.queryJson<{name: string; value: string}>(
    "SELECT name, value FROM duckdb_settings() WHERE name IN ('lock_configuration', 'enable_external_access', 'allow_persistent_secrets', 'allow_unsigned_extensions', 'allow_extensions_metadata_mismatch', 'allow_unredacted_secrets', 'autoinstall_known_extensions', 'autoload_known_extensions')",
  );
  if (
    [...rows].some(
      ({name, value}) =>
        value !== (name === 'lock_configuration' ? 'true' : 'false'),
    )
  )
    throw new Error('Analytical security configuration did not lock.');
}
