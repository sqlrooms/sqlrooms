import {useDuckDb, type TableColumn} from '@sqlrooms/duckdb';
import type * as arrow from 'apache-arrow';
import {useEffect, useMemo, useState} from 'react';
import {
  isDeckMapDashboardSqlDatasetSource,
  isDeckMapDashboardTableDatasetSource,
  type DeckMapDashboardDatasetSource,
} from './dashboardConfig';
import {createDeckTableDatasetSql} from './datasets/tableDatasetSql';

const EMPTY_COLUMNS: TableColumn[] = [];
const GENERATED_COLUMN_NAMES = new Set([
  '__sqlrooms_geom',
  'source_geom',
  'target_geom',
  'timestamps',
]);

export type DeckMapResolvedDatasetSchema = {
  sourceColumns: TableColumn[];
  outputColumns: TableColumn[];
  generatedOutputColumns: TableColumn[];
  dataOutputColumns: TableColumn[];
};

export type DeckMapDatasetSchemaState = DeckMapResolvedDatasetSchema & {
  isLoading: boolean;
  error: Error | null;
};

export function isDeckMapGeneratedColumn(columnName: string) {
  return GENERATED_COLUMN_NAMES.has(columnName);
}

function cleanSql(sql: string) {
  return sql.trim().replace(/(?:\s*;+\s*)+$/, '');
}

function createDatasetOutputSql(source: DeckMapDashboardDatasetSource) {
  if (isDeckMapDashboardSqlDatasetSource(source)) {
    return cleanSql(source.sqlQuery);
  }

  return createDeckTableDatasetSql(source);
}

export function createDeckMapDatasetOutputSchemaSql(
  source: DeckMapDashboardDatasetSource,
) {
  return [
    'SELECT *',
    `FROM (${createDatasetOutputSql(source)}) AS "__sqlrooms_schema_source"`,
    'LIMIT 0',
  ].join('\n');
}

export function resolveDeckMapDatasetSchema(options: {
  sourceColumns: TableColumn[];
  outputColumns: TableColumn[];
  classifyGeneratedColumns?: boolean;
}): DeckMapResolvedDatasetSchema {
  const sourceColumnNames = new Set(
    options.sourceColumns.map((column) => column.name),
  );
  const isGeneratedOutputColumn = (column: TableColumn) =>
    options.classifyGeneratedColumns === true &&
    isDeckMapGeneratedColumn(column.name) &&
    !sourceColumnNames.has(column.name);
  const generatedOutputColumns = options.outputColumns.filter(
    isGeneratedOutputColumn,
  );
  const dataOutputColumns = options.outputColumns.filter(
    (column) => !isGeneratedOutputColumn(column),
  );

  return {
    sourceColumns: options.sourceColumns,
    outputColumns: options.outputColumns,
    generatedOutputColumns,
    dataOutputColumns,
  };
}

function shouldInspectOutputSchema(
  source: DeckMapDashboardDatasetSource | undefined,
) {
  return Boolean(
    source &&
    (isDeckMapDashboardSqlDatasetSource(source) ||
      (isDeckMapDashboardTableDatasetSource(source) &&
        source.transformSql?.trim())),
  );
}

function arrowSchemaToTableColumns(table: arrow.Table): TableColumn[] {
  return table.schema.fields.map((field) => ({
    name: field.name,
    type: String(field.type),
  }));
}

export function useDeckMapDatasetSchema(options: {
  source: DeckMapDashboardDatasetSource | undefined;
  sourceColumns: TableColumn[];
}): DeckMapDatasetSchemaState {
  const connector = useDuckDb();
  const [state, setState] = useState<{
    sourceKey: string;
    outputColumns: TableColumn[];
    error: Error | null;
  }>({
    sourceKey: '',
    outputColumns: [],
    error: null,
  });

  const shouldInspect = shouldInspectOutputSchema(options.source);
  const sourceKey = isDeckMapDashboardSqlDatasetSource(options.source)
    ? options.source.sqlQuery
    : isDeckMapDashboardTableDatasetSource(options.source)
      ? `${options.source.tableName}\n${options.source.transformSql ?? ''}`
      : '';

  useEffect(() => {
    const source = options.source;

    if (!source || !shouldInspect) {
      return;
    }

    const abortController = new AbortController();
    let isActive = true;

    void (async () => {
      try {
        const table = await connector.query(
          createDeckMapDatasetOutputSchemaSql(source),
          {
            signal: abortController.signal,
          },
        );
        if (!isActive || abortController.signal.aborted) return;
        setState({
          sourceKey,
          outputColumns: arrowSchemaToTableColumns(table),
          error: null,
        });
      } catch (error) {
        if (!isActive || abortController.signal.aborted) return;
        setState({
          sourceKey,
          outputColumns: [],
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    })();

    return () => {
      isActive = false;
      abortController.abort();
    };
  }, [connector, options.source, shouldInspect, sourceKey]);

  const isCurrentInspectedSource =
    shouldInspect && state.sourceKey === sourceKey;
  const outputColumns = useMemo(() => {
    if (shouldInspect) {
      return isCurrentInspectedSource ? state.outputColumns : EMPTY_COLUMNS;
    }

    return options.source ? options.sourceColumns : EMPTY_COLUMNS;
  }, [
    isCurrentInspectedSource,
    options.source,
    options.sourceColumns,
    shouldInspect,
    state.outputColumns,
  ]);

  const resolved = useMemo(
    () =>
      resolveDeckMapDatasetSchema({
        sourceColumns: options.sourceColumns,
        outputColumns,
        classifyGeneratedColumns:
          isDeckMapDashboardTableDatasetSource(options.source) &&
          Boolean(options.source.transformSql?.trim()),
      }),
    [options.source, options.sourceColumns, outputColumns],
  );

  return {
    ...resolved,
    isLoading: shouldInspect && !isCurrentInspectedSource,
    error: isCurrentInspectedSource ? state.error : null,
  };
}
