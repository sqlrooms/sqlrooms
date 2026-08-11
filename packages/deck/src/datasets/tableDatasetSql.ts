import {quoteParsedRawSqlTableReference} from '@sqlrooms/duckdb';
import type {DeckTableDatasetInput} from '../types';

/** Reserved relation name that table dataset transforms must read from. */
export const DECK_TABLE_DATASET_SOURCE_RELATION = '__sqlrooms_source';

/** Error thrown when a table dataset input cannot be compiled to a table ref. */
export class DeckTableDatasetInvalidTableNameError extends Error {
  constructor() {
    super('Deck table dataset input requires a valid tableName.');
    this.name = 'DeckTableDatasetInvalidTableNameError';
  }
}

function cleanTransformSql(transformSql: string): string {
  return transformSql.trim().replace(/(?:\s*;+\s*)+$/, '');
}

function createTransformedTableDatasetSql(options: {
  tableReference: string;
  transformSql: string;
}) {
  return [
    `WITH ${DECK_TABLE_DATASET_SOURCE_RELATION} AS (`,
    `  SELECT * FROM ${options.tableReference}`,
    `)`,
    `SELECT *`,
    `FROM (`,
    options.transformSql,
    `) AS "__sqlrooms_transform"`,
  ].join('\n');
}

/**
 * Compiles a structured table dataset input into executable SQL.
 *
 * Direct table inputs compile to `SELECT * FROM <quoted table>`. Transformed
 * inputs bind the table to the reserved `__sqlrooms_source` CTE and nest the
 * authored `transformSql` so its CTEs remain self-contained.
 */
export function createDeckTableDatasetSql(
  input: DeckTableDatasetInput,
): string {
  const tableReference = quoteParsedRawSqlTableReference(input.tableName);
  if (!tableReference) {
    throw new DeckTableDatasetInvalidTableNameError();
  }

  if (!input.transformSql?.trim()) {
    return `SELECT * FROM ${tableReference}`;
  }

  const transformSql = cleanTransformSql(input.transformSql);
  if (
    !new RegExp(`\\b${DECK_TABLE_DATASET_SOURCE_RELATION}\\b`, 'i').test(
      transformSql,
    )
  ) {
    throw new Error(
      `Deck table dataset transformSql must reference ${DECK_TABLE_DATASET_SOURCE_RELATION}.`,
    );
  }

  return createTransformedTableDatasetSql({
    tableReference,
    transformSql,
  });
}
