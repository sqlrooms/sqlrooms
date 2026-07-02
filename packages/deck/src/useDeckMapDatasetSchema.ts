import {useDuckDb, type TableColumn} from '@sqlrooms/duckdb';
import * as arrow from 'apache-arrow';
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

function mapArrowIntTypeToDuckDb(type: arrow.DataType): string {
  const {bitWidth, isSigned} = type as {bitWidth?: number; isSigned?: boolean};

  if (isSigned === false) {
    switch (bitWidth) {
      case 8:
        return 'UTINYINT';
      case 16:
        return 'USMALLINT';
      case 32:
        return 'UINTEGER';
      case 64:
        return 'UBIGINT';
      default:
        return 'UINTEGER';
    }
  }

  switch (bitWidth) {
    case 8:
      return 'TINYINT';
    case 16:
      return 'SMALLINT';
    case 32:
      return 'INTEGER';
    case 64:
      return 'BIGINT';
    default:
      return 'INTEGER';
  }
}

export function arrowTypeToDuckDbColumnType(type: arrow.DataType): string {
  if (arrow.DataType.isInt(type)) {
    return mapArrowIntTypeToDuckDb(type);
  }

  if (arrow.DataType.isFloat(type)) {
    return (type as {precision?: number}).precision === 1 ? 'FLOAT' : 'DOUBLE';
  }

  if (arrow.DataType.isDecimal(type)) {
    return 'DECIMAL';
  }

  if (arrow.DataType.isUtf8(type) || arrow.DataType.isLargeUtf8(type)) {
    return 'VARCHAR';
  }

  if (
    arrow.DataType.isBinary(type) ||
    arrow.DataType.isLargeBinary(type) ||
    arrow.DataType.isFixedSizeBinary(type)
  ) {
    return 'BLOB';
  }

  if (arrow.DataType.isBool(type)) {
    return 'BOOLEAN';
  }

  if (arrow.DataType.isDate(type)) {
    return 'DATE';
  }

  if (arrow.DataType.isTime(type)) {
    return 'TIME';
  }

  if (arrow.DataType.isTimestamp(type)) {
    switch ((type as {unit?: number}).unit) {
      case 0:
        return 'TIMESTAMP_S';
      case 1:
        return 'TIMESTAMP_MS';
      case 3:
        return 'TIMESTAMP_NS';
      default:
        return 'TIMESTAMP';
    }
  }

  return String(type);
}

function arrowSchemaToTableColumns(table: arrow.Table): TableColumn[] {
  return table.schema.fields.map((field) => ({
    name: field.name,
    type: arrowTypeToDuckDbColumnType(field.type),
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
