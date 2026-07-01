import {quoteParsedRawSqlTableReference} from '@sqlrooms/duckdb';
import type {DeckTableDatasetInput} from '../types';

export const DECK_TABLE_DATASET_SOURCE_RELATION = '__sqlrooms_source';

function cleanTransformSql(transformSql: string): string {
  return transformSql.trim().replace(/(?:\s*;+\s*)+$/, '');
}

/**
 * Compiles a structured table dataset input into executable SQL.
 *
 * Direct table inputs compile to `SELECT * FROM <quoted table>`. Transformed
 * inputs bind the table to the reserved `__sqlrooms_source` CTE and leave the
 * authored transform SQL untouched.
 */
export function createDeckTableDatasetSql(
  input: DeckTableDatasetInput,
): string {
  const tableReference = quoteParsedRawSqlTableReference(input.tableName);
  if (!tableReference) {
    throw new Error('Deck table dataset input requires a valid tableName.');
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

  return [
    `WITH ${DECK_TABLE_DATASET_SOURCE_RELATION} AS (`,
    `  SELECT * FROM ${tableReference}`,
    ')',
    transformSql,
  ].join('\n');
}
