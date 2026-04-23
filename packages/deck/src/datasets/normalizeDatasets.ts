import type * as arrow from 'apache-arrow';
import {
  isArrowTableDatasetInput,
  isSqlDatasetInput,
  type DeckDatasetInput,
  type DeckJsonMapProps,
} from '../types';
import {toArrowTable} from './tableAdapter';

function normalizeDatasetEntry(
  datasetId: string,
  input: DeckDatasetInput,
): DeckDatasetInput {
  if (isSqlDatasetInput(input)) {
    return {
      sqlQuery: input.sqlQuery,
      geometryColumn: input.geometryColumn,
      geometryEncodingHint: input.geometryEncodingHint,
    };
  }

  if (isArrowTableDatasetInput(input)) {
    return {
      arrowTable: input.arrowTable,
      geometryColumn: input.geometryColumn,
      geometryEncodingHint: input.geometryEncodingHint,
    };
  }

  throw new Error(
    `Dataset "${datasetId}" has an unrecognized input shape. Expected either { sqlQuery } or { arrowTable }.`,
  );
}

export function resolveArrowTable(
  input: DeckDatasetInput,
): arrow.Table | undefined {
  if (!isArrowTableDatasetInput(input) || input.arrowTable === undefined) {
    return undefined;
  }

  return toArrowTable(input.arrowTable);
}

/**
 * Validate and normalize a raw datasets record into canonical
 * `DeckDatasetInput` entries.
 *
 * @throws {Error} If `datasets` is empty (DeckJsonMap requires at least one entry).
 */
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
