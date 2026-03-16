import type {DataTable, TableColumn} from '@sqlrooms/duckdb';

export interface ParsedQualifiedColumnName {
  columnName: string;
  tableName?: string;
  schemaName?: string;
  databaseName?: string;
}

/**
 * Parses a qualified column name into its components
 * Supports:
 * - columnName
 * - tableName.columnName
 * - schemaName.tableName.columnName
 * - databaseName.schemaName.tableName.columnName
 */
export function parseQualifiedColumnName(
  word: string,
): ParsedQualifiedColumnName {
  const parts = word.split('.');

  if (parts.length === 2) {
    return {
      tableName: parts[0],
      columnName: parts[1]!,
    };
  } else if (parts.length === 3) {
    return {
      schemaName: parts[0],
      tableName: parts[1],
      columnName: parts[2]!,
    };
  } else if (parts.length === 4) {
    return {
      databaseName: parts[0],
      schemaName: parts[1],
      tableName: parts[2],
      columnName: parts[3]!,
    };
  } else {
    return {columnName: word};
  }
}

export interface ParsedQualifiedTableName {
  tableName: string;
  schemaName?: string;
  databaseName?: string;
}

/**
 * Parses a qualified table name into its components
 * Supports:
 * - tableName
 * - schemaName.tableName
 * - databaseName.schemaName.tableName
 */
export function parseQualifiedTableName(
  word: string,
): ParsedQualifiedTableName {
  const parts = word.split('.');

  if (parts.length === 2) {
    return {
      schemaName: parts[0],
      tableName: parts[1]!,
    };
  } else if (parts.length === 3) {
    return {
      databaseName: parts[0],
      schemaName: parts[1],
      tableName: parts[2]!,
    };
  } else {
    return {tableName: word};
  }
}

/**
 * Finds a table and column by qualified name (case-insensitive)
 */
export function findTableAndColumn(
  qualifiedName: ParsedQualifiedColumnName,
  tables: DataTable[],
): {table: DataTable; column: TableColumn} | undefined {
  const {columnName, tableName, schemaName, databaseName} = qualifiedName;

  for (const table of tables) {
    // Check if table matches the qualification (case-insensitive)
    if (
      databaseName &&
      table.table.database?.localeCompare(databaseName, undefined, {
        sensitivity: 'accent',
      }) !== 0
    ) {
      continue;
    }
    if (
      schemaName &&
      table.table.schema?.localeCompare(schemaName, undefined, {
        sensitivity: 'accent',
      }) !== 0
    ) {
      continue;
    }
    if (
      tableName &&
      table.table.table?.localeCompare(tableName, undefined, {
        sensitivity: 'accent',
      }) !== 0
    ) {
      continue;
    }

    // Find the column (case-insensitive)
    const column = table.columns.find(
      (col) =>
        col.name?.localeCompare(columnName, undefined, {
          sensitivity: 'accent',
        }) === 0,
    );
    if (column) {
      return {table, column};
    }
  }

  return undefined;
}

/**
 * Finds a table by qualified name (case-insensitive)
 */
export function findTable(
  qualifiedName: ParsedQualifiedTableName,
  tables: DataTable[],
): DataTable | undefined {
  const {tableName, schemaName, databaseName} = qualifiedName;

  return tables.find((table) => {
    // Match table name (case-insensitive)
    if (
      table.table.table?.localeCompare(tableName, undefined, {
        sensitivity: 'accent',
      }) !== 0
    ) {
      return false;
    }

    // Match schema if specified
    if (
      schemaName &&
      table.table.schema?.localeCompare(schemaName, undefined, {
        sensitivity: 'accent',
      }) !== 0
    ) {
      return false;
    }

    // Match database if specified
    if (
      databaseName &&
      table.table.database?.localeCompare(databaseName, undefined, {
        sensitivity: 'accent',
      }) !== 0
    ) {
      return false;
    }

    return true;
  });
}
