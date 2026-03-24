import type React from 'react';
import type {DataTable} from '@sqlrooms/duckdb';
import {getDuckDbTypeCategory} from '@sqlrooms/duckdb';
import type {NamespaceTooltipData} from '@marimo-team/codemirror-sql';
import {ColumnTypeBadge} from '@sqlrooms/data-table';
import {Badge} from '@sqlrooms/ui';
import {
  parseQualifiedColumnName,
  findTableAndColumn,
} from '../utils/qualified-name-parser';

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
