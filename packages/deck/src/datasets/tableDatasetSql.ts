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
  const leadingWith = /^\s*WITH\s+(RECURSIVE\s+)?/i.exec(options.transformSql);
  const withKeyword = leadingWith?.[1] ? 'WITH RECURSIVE' : 'WITH';
  const transformBody = leadingWith
    ? options.transformSql.slice(leadingWith[0].length)
    : options.transformSql;
  const cteSeparator = leadingWith ? ',' : '';

  return [
    `${withKeyword} ${DECK_TABLE_DATASET_SOURCE_RELATION} AS (`,
    `  SELECT * FROM ${options.tableReference}`,
    `)${cteSeparator}`,
    transformBody,
  ].join('\n');
}

/**
 * Compiles a structured table dataset input into executable SQL.
 *
 * Direct table inputs compile to `SELECT * FROM <quoted table>`. Transformed
 * inputs bind the table to the reserved `__sqlrooms_source` CTE and preserve
 * any authored CTEs from `transformSql`.
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
