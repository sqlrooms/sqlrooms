import type React from 'react';
import type {DataTable} from '@sqlrooms/duckdb';
import type {NamespaceTooltipData} from '@marimo-team/codemirror-sql';
import {Badge} from '@sqlrooms/ui';
import {SqlColumnsTable} from './SqlColumnsTable';

export interface SqlTableTooltipProps {
  data: NamespaceTooltipData;
  tables: DataTable[];
}

export const SqlTableTooltip: React.FC<SqlTableTooltipProps> = ({
  data: {word: tableName},
  tables,
}) => {
  const table = tables.find((table) => table.table.table === tableName);

  const typeLabel = table?.isView ? 'view' : 'table';
  const rowCount = table?.rowCount;
  const columns = table?.columns;

  return (
    <div className="flex flex-col gap-1.5 text-xs">
      <div className="flex flex-row gap-1 text-sm">
        <strong className="text-foreground!">{tableName}</strong>
        <Badge variant="secondary" className="text-[9px] uppercase">
          {typeLabel}
        </Badge>
      </div>
      {columns && <SqlColumnsTable columns={columns} />}
      {rowCount !== undefined && (
        <div className="text-muted-foreground">
          {rowCount.toLocaleString()} rows
        </div>
      )}
    </div>
  );
};
