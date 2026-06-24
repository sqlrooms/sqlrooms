import type {DataTable} from '@sqlrooms/db';
import {EditableText} from '@sqlrooms/ui';
import {FC} from 'react';
import {DataTableExplorer} from '../DataTableExplorer';

export type DataTableBlockHeaderProps = {
  caption?: string;
  onCaptionChange?: (caption: string | undefined) => void;
  readOnly?: boolean;
  selectedTable: DataTable;
};

export const DataTableBlockHeader: FC<DataTableBlockHeaderProps> = ({
  caption,
  onCaptionChange,
  readOnly,
  selectedTable,
}) => {
  const tableName = selectedTable.table.table;

  return (
    <div className="border-border flex shrink-0 items-center gap-2 border-b px-3 py-2">
      <EditableText
        className="min-w-0 flex-1 text-sm font-medium"
        value={caption ?? ''}
        placeholder={tableName || 'Table caption'}
        isReadOnly={readOnly}
        onChange={(value) => onCaptionChange?.(value || undefined)}
      />
      <DataTableExplorer.ResetButton />
    </div>
  );
};
