import type React from 'react';
import type {TableColumn} from '@sqlrooms/duckdb';
import {getDuckDbTypeCategory} from '@sqlrooms/duckdb';
import {ColumnTypeBadge} from '@sqlrooms/data-table';

export interface SqlColumnsTableProps {
  columns: TableColumn[];
}

/**
 * Component for displaying a table of columns with their types
 */
export const SqlColumnsTable: React.FC<SqlColumnsTableProps> = ({columns}) => {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="font-semibold">Columns ({columns.length})</div>
      <div className="max-h-[200px] overflow-y-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border-border bg-muted border-b px-2 py-1 text-left font-semibold">
                Name
              </th>
              <th className="border-border bg-muted border-b px-2 py-1 text-left font-semibold">
                Type
              </th>
            </tr>
          </thead>
          <tbody>
            {columns.map((col) => (
              <tr key={col.name}>
                <td className="border-border border-b px-2 py-1">
                  <code className="bg-muted! text-foreground! rounded-sm px-1 py-0.5 font-mono">
                    {col.name}
                  </code>
                </td>
                <td className="border-border border-b px-2 py-1">
                  <ColumnTypeBadge
                    columnType={col.type}
                    typeCategory={getDuckDbTypeCategory(col.type)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
