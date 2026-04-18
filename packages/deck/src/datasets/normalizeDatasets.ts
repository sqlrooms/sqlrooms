import type * as arrow from 'apache-arrow';
import type {DeckDatasetInput, DeckMapProps, DeckQueryResultLike} from '../types';

function getArrowTableFromQueryResult(queryResult: DeckQueryResultLike | undefined) {
  return queryResult?.arrowTable;
}

function countDefinedInputs(input: DeckDatasetInput) {
  return Number(Boolean(input.sqlQuery)) +
    Number(Boolean(input.arrowTable)) +
    Number(Boolean(input.queryResult));
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
  const normalized: DeckDatasetInput = {
    sqlQuery: input.sqlQuery,
    arrowTable: input.arrowTable,
    queryResult: input.queryResult,
    geometryColumn: input.geometryColumn,
    geometryEncodingHint: input.geometryEncodingHint,
  };

  const definedInputs = countDefinedInputs(normalized);
  if (definedInputs !== 1) {
    throw new Error(
      `Dataset "${datasetId}" must provide exactly one of sqlQuery, arrowTable, or queryResult.`,
    );
  }

  if (normalized.queryResult) {
    assertArrowTable(getArrowTableFromQueryResult(normalized.queryResult), datasetId);
  }

  return normalized;
}

export function resolveArrowTable(
  input: DeckDatasetInput,
): arrow.Table | undefined {
  return input.arrowTable ?? getArrowTableFromQueryResult(input.queryResult);
}

export function normalizeDatasets(
  props: Pick<
    DeckMapProps,
    | 'datasets'
    | 'sqlQuery'
    | 'arrowTable'
    | 'queryResult'
    | 'geometryColumn'
    | 'geometryEncodingHint'
  >,
): Record<string, DeckDatasetInput> {
  if (props.datasets) {
    const entries = Object.entries(props.datasets).map(([datasetId, input]) => [
      datasetId,
      normalizeDatasetEntry(datasetId, input),
    ]);
    return Object.fromEntries(entries);
  }

  const singleInput: DeckDatasetInput = {
    sqlQuery: props.sqlQuery,
    arrowTable: props.arrowTable,
    queryResult: props.queryResult,
    geometryColumn: props.geometryColumn,
    geometryEncodingHint: props.geometryEncodingHint,
  };

  const definedInputs = countDefinedInputs(singleInput);
  if (definedInputs === 0) {
    throw new Error(
      'DeckMap requires either datasets or one of sqlQuery, arrowTable, or queryResult.',
    );
  }

  return {
    default: normalizeDatasetEntry('default', singleInput),
  };
}
