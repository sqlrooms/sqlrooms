import type * as arrow from 'apache-arrow';
import {
  isArrowTableDatasetInput,
  isSqlDatasetInput,
  type DeckDatasetInput,
  type DeckJsonMapProps,
} from '../types';
import {toArrowTable} from './tableAdapter';

function normalizeDatasetEntry(
  _datasetId: string,
  input: DeckDatasetInput,
): DeckDatasetInput {
  if (isSqlDatasetInput(input)) {
    return {
      sqlQuery: input.sqlQuery,
      geometryColumn: input.geometryColumn,
      geometryEncodingHint: input.geometryEncodingHint,
    };
  }

  return {
    arrowTable: input.arrowTable,
    geometryColumn: input.geometryColumn,
    geometryEncodingHint: input.geometryEncodingHint,
  };
}

export function resolveArrowTable(
  input: DeckDatasetInput,
): arrow.Table | undefined {
  if (!isArrowTableDatasetInput(input) || input.arrowTable === undefined) {
    return undefined;
  }

  return toArrowTable(input.arrowTable);
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
