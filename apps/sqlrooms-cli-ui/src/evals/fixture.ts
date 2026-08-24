import type {NodeDuckDbConnectorOptions} from '@sqlrooms/duckdb-node';

/** Canonical table requested by the deterministic CLI eval fixture. */
export const CLI_EVAL_TARGET_TABLE = '"analytics"."events"';

/**
 * Small geospatial fixture with deliberately ambiguous table names.
 * Distinct metrics make use of the intended canonical table observable.
 */
export const CLI_EVAL_FIXTURE_SQL = `
CREATE SCHEMA analytics;
CREATE SCHEMA archive;

CREATE TABLE analytics.events (
  observed_at TIMESTAMP,
  category VARCHAR,
  metric DOUBLE,
  latitude DOUBLE,
  longitude DOUBLE
);
INSERT INTO analytics.events VALUES
  ('2026-08-01 09:00:00', 'alpha', 11.0, 47.3769, 8.5417),
  ('2026-08-02 09:00:00', 'beta', 19.0, 46.9480, 7.4474),
  ('2026-08-03 09:00:00', 'alpha', 23.0, 46.2044, 6.1432);

CREATE TABLE archive.events (
  observed_at TIMESTAMP,
  category VARCHAR,
  metric DOUBLE,
  latitude DOUBLE,
  longitude DOUBLE
);
INSERT INTO archive.events VALUES
  ('2020-01-01 00:00:00', 'legacy', 9001.0, 0.0, 0.0);
`;

/** Creates Node DuckDB options for an isolated in-memory eval database. */
export function createCliEvalDuckDbOptions(): NodeDuckDbConnectorOptions {
  return {dbPath: ':memory:', initializationQuery: CLI_EVAL_FIXTURE_SQL};
}
