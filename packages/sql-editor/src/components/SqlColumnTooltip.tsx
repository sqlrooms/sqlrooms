import type React from 'react';
import type {DataTable, TableColumn} from '@sqlrooms/duckdb';
import {getDuckDbTypeCategory} from '@sqlrooms/duckdb';
import type {NamespaceTooltipData} from '@marimo-team/codemirror-sql';
import {ColumnTypeBadge} from '@sqlrooms/data-table';
import {Badge} from '@sqlrooms/ui';

interface ParsedQualifiedName {
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
function parseQualifiedColumnName(word: string): ParsedQualifiedName {
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

/**
 * Finds a table and column by qualified name
 */
function findTableAndColumn(
  qualifiedName: ParsedQualifiedName,
  tables: DataTable[],
): {table: DataTable; column: TableColumn} | undefined {
  const {columnName, tableName, schemaName, databaseName} = qualifiedName;

  for (const table of tables) {
    // Check if table matches the qualification
    if (databaseName && table.table.database !== databaseName) {
      continue;
    }
    if (schemaName && table.table.schema !== schemaName) {
      continue;
    }
    if (tableName && table.table.table !== tableName) {
      continue;
    }

    // Find the column
    const column = table.columns.find((col) => col.name === columnName);
    if (column) {
      return {table, column};
    }
  }

  return undefined;
}

export interface SqlColumnTooltipProps {
  data: NamespaceTooltipData;
  tables: DataTable[];
}

/**
 * React component for column tooltip
 */
export const SqlColumnTooltip: React.FC<SqlColumnTooltipProps> = ({
  data,
  tables,
}) => {
  const qualifiedName = parseQualifiedColumnName(data.word);
  const {table, column} = findTableAndColumn(qualifiedName, tables) ?? {};

  const tableTypeLabel = table?.isView ? 'view' : 'table';

  return (
    <div className="flex flex-col gap-1.5 text-xs">
      <div className="flex flex-row gap-1 text-sm">
        <strong className="text-foreground!">{qualifiedName.columnName}</strong>
        <Badge variant="secondary" className="text-[9px] uppercase">
          column
        </Badge>
      </div>
      {column && (
        <div className="flex flex-row gap-1">
          <strong className="text-foreground!">Type:</strong>
          <ColumnTypeBadge
            columnType={column.type}
            typeCategory={getDuckDbTypeCategory(column.type)}
          />
        </div>
      )}
      {table && (
        <div className="flex flex-row gap-1">
          <strong className="text-foreground!">From:</strong>{' '}
          {table.table.table}
          <Badge variant="secondary" className="text-[9px] uppercase">
            {tableTypeLabel}
          </Badge>
        </div>
      )}
    </div>
  );
};
