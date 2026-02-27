/**
 * Centralized policy for persisting SQL cell query results.
 *
 * This module implements an adaptive strategy:
 * - first run chooses `table` when downstream dependencies exist, otherwise
 *   `view`;
 * - subsequent runs preserve the previously chosen relation type.
 *
 * The policy is shared by execution, rename, and cleanup paths so behavior
 * stays consistent across cross-cutting lifecycle events. Cleanup intentionally
 * drops both relation variants (`VIEW` and `TABLE`) because historical runs or
 * migrations may have created either form for the same logical result name.
 */
export type ResultRelationType = 'view' | 'table';

type SqlConnectorLike = {
  query: (
    sql: string,
    options?: {signal?: AbortSignal},
  ) => PromiseLike<unknown>;
};

/**
 * Chooses whether a SQL cell result should be stored as a logical view or a
 * materialized table.
 *
 * The policy is sticky: once a relation type has been selected for a cell,
 * later executions preserve that choice. On first execution, downstream usage
 * is used as a proxy for reuse.
 */
export function chooseAdaptiveRelationType(args: {
  previousRelationType?: ResultRelationType;
  hasDownstream: boolean;
}): ResultRelationType {
  const {previousRelationType, hasDownstream} = args;
  if (previousRelationType) return previousRelationType;
  return hasDownstream ? 'table' : 'view';
}

/**
 * Creates or replaces the relation that backs a SQL cell result.
 *
 * - `table`: materializes data for stable repeated reads.
 * - `view`: stores query definition for lightweight freshness.
 */
export async function createOrReplaceResultRelation(args: {
  connector: SqlConnectorLike;
  relationName: string;
  relationType: ResultRelationType;
  sql: string;
  signal?: AbortSignal;
}) {
  const {connector, relationName, relationType, sql, signal} = args;
  if (relationType === 'table') {
    await connector.query(`CREATE OR REPLACE TABLE ${relationName} AS ${sql}`, {
      signal,
    });
    return;
  }
  await connector.query(`CREATE OR REPLACE VIEW ${relationName} AS ${sql}`, {
    signal,
  });
}

/**
 * Drops both view and table variants for a relation name.
 *
 * This is intentionally defensive because different runs may have used
 * different relation modes.
 */
export async function dropResultRelation(args: {
  connector: SqlConnectorLike;
  relationName?: string;
}) {
  const {connector, relationName} = args;
  if (!relationName) return;
  await connector.query(`DROP VIEW IF EXISTS ${relationName}`);
  await connector.query(`DROP TABLE IF EXISTS ${relationName}`);
}

/**
 * Renames a saved SQL cell result relation while preserving its mode.
 *
 * - `table`: copies current relation data into the new name.
 * - `view`: recreates the view definition under the new name.
 *
 * Any existing destination relation is removed first, and the old source name
 * is cleaned up after the new relation is created.
 */
export async function renameResultRelation(args: {
  connector: SqlConnectorLike;
  oldRelationName: string;
  newRelationName: string;
  relationType: ResultRelationType;
  viewSql: string;
}) {
  const {connector, oldRelationName, newRelationName, relationType, viewSql} =
    args;

  // Clear destination first in case a stale object exists.
  await dropResultRelation({connector, relationName: newRelationName});

  if (relationType === 'table') {
    await connector.query(
      `CREATE TABLE ${newRelationName} AS SELECT * FROM ${oldRelationName}`,
    );
  } else {
    await connector.query(`CREATE VIEW ${newRelationName} AS ${viewSql}`);
  }

  await dropResultRelation({connector, relationName: oldRelationName});
}
