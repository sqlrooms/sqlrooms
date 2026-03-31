import {useSql} from '@sqlrooms/db';
import * as arrow from 'apache-arrow';
import {useMemo} from 'react';
import {useVegaCellBaseTable} from './useVegaCellBaseTable';
import {parseTableReference, type TableReference} from './vegaTableReference';
import {VegaCell} from '../types';
import {useVegaCellVersion} from './useVegaCellVersion';

export interface VegaCellSchemaResult {
  fields: arrow.Field[] | undefined;
  arrowTable: arrow.Table | undefined;
  isLoading: boolean;
  error: Error | undefined;
}

/**
 * Maps DuckDB data type names to Arrow DataType objects.
 * This is a basic mapping - expand as needed for more types.
 */
function mapDuckDbTypeToArrow(duckdbType: string): arrow.DataType {
  const upperType = duckdbType.toUpperCase();

  // String types
  if (
    upperType.startsWith('VARCHAR') ||
    upperType === 'TEXT' ||
    upperType === 'STRING'
  ) {
    return new arrow.Utf8();
  }

  // Integer types
  if (upperType === 'BIGINT' || upperType === 'INT8' || upperType === 'LONG') {
    return new arrow.Int64();
  }
  if (
    upperType === 'INTEGER' ||
    upperType === 'INT4' ||
    upperType === 'INT' ||
    upperType === 'SIGNED'
  ) {
    return new arrow.Int32();
  }
  if (
    upperType === 'SMALLINT' ||
    upperType === 'INT2' ||
    upperType === 'SHORT'
  ) {
    return new arrow.Int16();
  }
  if (upperType === 'TINYINT' || upperType === 'INT1') {
    return new arrow.Int8();
  }
  if (upperType === 'UBIGINT') {
    return new arrow.Uint64();
  }
  if (upperType === 'UINTEGER') {
    return new arrow.Uint32();
  }
  if (upperType === 'USMALLINT') {
    return new arrow.Uint16();
  }
  if (upperType === 'UTINYINT') {
    return new arrow.Uint8();
  }

  // Float types
  if (upperType === 'DOUBLE' || upperType === 'FLOAT8') {
    return new arrow.Float64();
  }
  if (upperType === 'FLOAT' || upperType === 'FLOAT4' || upperType === 'REAL') {
    return new arrow.Float32();
  }

  // Boolean
  if (
    upperType === 'BOOLEAN' ||
    upperType === 'BOOL' ||
    upperType === 'LOGICAL'
  ) {
    return new arrow.Bool();
  }

  // Date/Time types
  if (upperType === 'DATE') {
    return new arrow.DateDay();
  }
  if (upperType === 'TIMESTAMP' || upperType.startsWith('TIMESTAMP')) {
    return new arrow.TimestampMillisecond();
  }
  if (upperType === 'TIME') {
    return new arrow.TimeMillisecond();
  }
  if (upperType === 'INTERVAL') {
    return new arrow.IntervalDayTime();
  }

  // Binary types
  if (upperType === 'BLOB' || upperType === 'BYTEA' || upperType === 'BINARY') {
    return new arrow.Binary();
  }

  // UUID
  if (upperType === 'UUID') {
    return new arrow.Utf8(); // Treat as string
  }

  // Default fallback
  console.warn(
    `[useVegaCellSchema] Unknown DuckDB type: ${duckdbType}, defaulting to string`,
  );
  return new arrow.Utf8();
}

/**
 * Hook to query schema for a Vega cell's data source using DuckDB metadata.
 * Works for both SQL cells (via resultView) and direct table references.
 *
 * Uses duckdb_columns() system function for pure metadata query.
 */
export function useVegaCellSchema(cell: VegaCell): VegaCellSchemaResult {
  const baseTable = useVegaCellBaseTable(cell);
  const version = useVegaCellVersion(cell);

  const tableRef = parseTableReference(baseTable ?? '');

  // Only enable query if we have a valid table reference
  const enabled = !!(baseTable && tableRef?.table);

  // Build schema query using duckdb_columns() for metadata-only lookup
  const schemaQuery =
    enabled && tableRef ? getVegaCellSchemaQuery(tableRef) : '';

  const result = useSql({
    query: schemaQuery,
    enabled,
    version,
  });

  const fields = useMemo(() => {
    const metadataTable = result.data?.arrowTable;
    if (!metadataTable || metadataTable.numRows === 0) {
      return undefined;
    }

    // Parse metadata rows to reconstruct original table schema
    const columnNameCol = metadataTable.getChild('column_name');
    const dataTypeCol = metadataTable.getChild('data_type');

    if (!columnNameCol || !dataTypeCol) {
      return undefined;
    }

    const fields: arrow.Field[] = [];
    for (let i = 0; i < metadataTable.numRows; i++) {
      const columnName = columnNameCol.get(i);
      const dataType = dataTypeCol.get(i);

      if (columnName && dataType) {
        const arrowType = mapDuckDbTypeToArrow(String(dataType));
        fields.push(new arrow.Field(String(columnName), arrowType));
      }
    }

    return fields;
  }, [result.data?.arrowTable]);

  return {
    fields,
    arrowTable: result.data?.arrowTable,
    isLoading: result.isLoading,
    error: result.error ?? undefined,
  };
}

function getVegaCellSchemaQuery(tableRef: TableReference) {
  const conditions = [
    tableRef.database ? `database_name = '${tableRef.database}'` : null,
    tableRef.schema ? `schema_name = '${tableRef.schema}'` : null,
    `table_name = '${tableRef.table}'`,
  ].filter(Boolean);

  return `
SELECT
  column_name,
  data_type,
  column_index
FROM duckdb_columns()
WHERE ${conditions.join(' AND ')}
ORDER BY column_index`;
}
