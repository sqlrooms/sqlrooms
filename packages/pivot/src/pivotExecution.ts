import {escapeId, type DuckDbConnector} from '@sqlrooms/duckdb';
import {
  buildCellsQuery,
  buildColTotalsQuery,
  buildGrandTotalQuery,
  buildPivotExportQuery,
  buildRowTotalsQuery,
} from './sql';
import type {PivotConfig, PivotQuerySource, PivotRelationViews} from './types';

export function createPivotRelationViews(
  relationBaseName: string,
  schemaName = 'main',
): PivotRelationViews {
  const qualify = (suffix: string) =>
    `${escapeId(schemaName)}.${escapeId(`${relationBaseName}_${suffix}`)}`;

  return {
    cells: qualify('cells'),
    rowTotals: qualify('row_totals'),
    colTotals: qualify('col_totals'),
    grandTotal: qualify('grand_total'),
    export: qualify('export'),
  };
}

export async function createOrReplacePivotRelations(args: {
  connector: DuckDbConnector;
  source: PivotQuerySource;
  config: PivotConfig;
  relationBaseName: string;
  schemaName?: string;
  signal?: AbortSignal;
}): Promise<PivotRelationViews> {
  const {
    connector,
    source,
    config,
    relationBaseName,
    schemaName = 'main',
    signal,
  } = args;
  const relations = createPivotRelationViews(relationBaseName, schemaName);

  await connector.query(`CREATE SCHEMA IF NOT EXISTS ${escapeId(schemaName)}`, {
    signal,
  });

  const cellsQuery = buildCellsQuery(config, source);
  const rowTotalsQuery = buildRowTotalsQuery(config, source);
  const colTotalsQuery = buildColTotalsQuery(config, source);
  const grandTotalQuery = buildGrandTotalQuery(config, source);

  await connector.query(
    `CREATE OR REPLACE VIEW ${relations.cells} AS ${cellsQuery}`,
    {signal},
  );
  await connector.query(
    `CREATE OR REPLACE VIEW ${relations.rowTotals} AS ${rowTotalsQuery}`,
    {signal},
  );
  await connector.query(
    `CREATE OR REPLACE VIEW ${relations.colTotals} AS ${colTotalsQuery}`,
    {signal},
  );
  await connector.query(
    `CREATE OR REPLACE VIEW ${relations.grandTotal} AS ${grandTotalQuery}`,
    {signal},
  );

  const colLabels = await connector.query(
    `SELECT DISTINCT col_label FROM ${relations.cells} ORDER BY col_label`,
    {signal},
  );
  const colKeys = Array.from(
    {length: colLabels.numRows},
    (_, index) => String(colLabels.getChild('col_label')?.get(index) ?? ''),
  );
  const exportQuery = buildPivotExportQuery(config, source, colKeys);
  await connector.query(
    `CREATE OR REPLACE VIEW ${relations.export} AS ${exportQuery}`,
    {signal},
  );

  return relations;
}

export async function dropPivotRelations(args: {
  connector: DuckDbConnector;
  relations?: PivotRelationViews;
}) {
  const {connector, relations} = args;
  if (!relations) {
    return;
  }

  for (const relation of Object.values(relations)) {
    if (!relation) continue;
    try {
      await connector.query(`DROP VIEW IF EXISTS ${relation}`);
    } catch {
      // Best-effort cleanup.
    }
  }
}
