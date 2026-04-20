import type * as arrow from 'apache-arrow';
import {
  isArrowTableDatasetInput,
  isQueryResultDatasetInput,
  isSqlDatasetInput,
  type DeckDatasetInput,
  type DeckJsonMapProps,
  type DeckQueryResultLike,
} from '../types';

function getArrowTableFromQueryResult(
  queryResult: DeckQueryResultLike | undefined,
) {
  return queryResult?.arrowTable;
}

function assertArrowTable(value: arrow.Table | undefined, datasetId: string) {
  if (!value) {
    throw new Error(
      `Dataset "${datasetId}" queryResult did not expose an arrowTable.`,
    );
  }
}

function normalizeDatasetEntry(
  datasetId: string,
  input: DeckDatasetInput,
): DeckDatasetInput {
  if (isSqlDatasetInput(input)) {
    return {
      source: 'sql',
      sqlQuery: input.sqlQuery,
      geometryColumn: input.geometryColumn,
      geometryEncodingHint: input.geometryEncodingHint,
    };
  }

  if (isArrowTableDatasetInput(input)) {
    return {
      source: 'arrowTable',
      arrowTable: input.arrowTable,
      geometryColumn: input.geometryColumn,
      geometryEncodingHint: input.geometryEncodingHint,
    };
  }

  assertArrowTable(getArrowTableFromQueryResult(input.queryResult), datasetId);
  return {
    source: 'queryResult',
    queryResult: input.queryResult,
    geometryColumn: input.geometryColumn,
    geometryEncodingHint: input.geometryEncodingHint,
  };
}

export function resolveArrowTable(
  input: DeckDatasetInput,
): arrow.Table | undefined {
  if (isArrowTableDatasetInput(input)) {
    return input.arrowTable;
  }

  if (isQueryResultDatasetInput(input)) {
    return getArrowTableFromQueryResult(input.queryResult);
  }

  return undefined;
}

export function normalizeDatasets(
  datasets: DeckJsonMapProps['datasets'],
): Record<string, DeckDatasetInput> {
  const entries = Object.entries(datasets);

  if (entries.length === 0) {
    throw new Error('DeckJsonMap requires at least one dataset entry.');
  }

  return Object.fromEntries(
    entries.map(([datasetId, input]) => [
      datasetId,
      normalizeDatasetEntry(datasetId, input),
    ]),
  );
}
