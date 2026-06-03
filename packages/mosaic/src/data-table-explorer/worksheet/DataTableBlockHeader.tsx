import type {DataTable} from '@sqlrooms/db';
import {FC} from 'react';
import {DataTableSelector} from '../../components/DataTableSelector';
import {DataTableExplorer} from '../DataTableExplorer';

export type DataTableBlockHeaderProps = {
  caption?: string;
  onTableChange: (table: DataTable) => void;
  readOnly?: boolean;
  tables: DataTable[];
  selectedTable: DataTable;
};

export const DataTableBlockHeader: FC<DataTableBlockHeaderProps> = ({
  caption,
  onTableChange,
  readOnly,
  selectedTable,
  tables,
}) => {
  return (
    <div className="border-border flex shrink-0 items-center gap-2 border-b px-3 py-2">
      {caption ? (
        <div className="min-w-0 flex-1 truncate text-sm font-medium">
          {caption}
        </div>
      ) : (
        <div className="flex-1" />
      )}
      <DataTableSelector
        className="w-48"
        disabled={readOnly || !onTableChange}
        onChange={onTableChange}
        tables={tables}
        value={selectedTable}
      />
      <DataTableExplorer.ResetButton />
    </div>
  );
};
