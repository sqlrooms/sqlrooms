import {
  escapeId,
  makeQualifiedTableName,
  type DataTable,
} from '@sqlrooms/duckdb';
import type {PivotConfig, PivotField, PivotRelations} from './types';
import {
  buildCellsQuery,
  buildColTotalsQuery,
  buildGrandTotalQuery,
  buildRowTotalsQuery,
} from './sql';

type SqlConnectorLike = {
  query: (
    sql: string,
    options?: {signal?: AbortSignal},
  ) => PromiseLike<unknown>;
};

export function buildPivotRelationNames(
  baseRelationName: string,
): PivotRelations {
  return {
    cellsRelation: `${baseRelationName}_cells`,
    rowTotalsRelation: `${baseRelationName}_row_totals`,
    colTotalsRelation: `${baseRelationName}_col_totals`,
    grandTotalRelation: `${baseRelationName}_grand_total`,
    relationType: 'view',
  };
}

export function buildPivotBaseRelationName(args: {
  relationId: string;
  schemaName: string;
  database?: string;
}) {
  return makeQualifiedTableName({
    table: `pivot_${args.relationId}`,
    schema: args.schemaName,
    database: args.database,
  }).toString();
}

export function getPivotFieldsFromTable(
  table: DataTable | undefined,
): PivotField[] {
  return (table?.columns ?? []).map((column) => ({
    name: column.name,
    type: column.type,
  }));
}

async function createOrReplaceView(args: {
  connector: SqlConnectorLike;
  relationName: string;
  sql: string;
  signal?: AbortSignal;
}) {
  const {connector, relationName, sql, signal} = args;
  await connector.query(
    `CREATE OR REPLACE VIEW ${relationName} AS ${sql}`,
    signal ? {signal} : undefined,
  );
}

export async function dropPivotRelations(args: {
  connector: SqlConnectorLike;
  relations?: Partial<PivotRelations>;
}) {
  const {connector, relations} = args;
  for (const relationName of [
    relations?.cellsRelation,
    relations?.rowTotalsRelation,
    relations?.colTotalsRelation,
    relations?.grandTotalRelation,
  ]) {
    if (!relationName) continue;
    await connector.query(`DROP VIEW IF EXISTS ${relationName}`);
    await connector.query(`DROP TABLE IF EXISTS ${relationName}`);
  }
}

export async function executePivotRelations(args: {
  connector: SqlConnectorLike;
  schemaName: string;
  sourceRelation: string;
  config: PivotConfig;
  relationId: string;
  database?: string;
  signal?: AbortSignal;
}) {
  const {
    connector,
    schemaName,
    sourceRelation,
    config,
    relationId,
    database,
    signal,
  } = args;
  await connector.query(
    `CREATE SCHEMA IF NOT EXISTS ${escapeId(schemaName)}`,
    signal ? {signal} : undefined,
  );

  const baseRelationName = buildPivotBaseRelationName({
    relationId,
    schemaName,
    database,
  });
  const relations = buildPivotRelationNames(baseRelationName);

  await createOrReplaceView({
    connector,
    relationName: relations.cellsRelation,
    sql: buildCellsQuery(config, sourceRelation),
    signal,
  });
  await createOrReplaceView({
    connector,
    relationName: relations.rowTotalsRelation,
    sql: buildRowTotalsQuery(config, sourceRelation),
    signal,
  });
  await createOrReplaceView({
    connector,
    relationName: relations.colTotalsRelation,
    sql: buildColTotalsQuery(config, sourceRelation),
    signal,
  });
  await createOrReplaceView({
    connector,
    relationName: relations.grandTotalRelation,
    sql: buildGrandTotalQuery(config, sourceRelation),
    signal,
  });

  return relations;
}
