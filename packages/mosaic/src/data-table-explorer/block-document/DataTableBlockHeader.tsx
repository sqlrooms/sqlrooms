import type {DataTable} from '@sqlrooms/db';
import {BlockCaptionEditor, BlockHeader} from '@sqlrooms/documents';
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
    <BlockHeader actions={<DataTableExplorer.ResetButton />}>
      <BlockCaptionEditor
        value={caption ?? ''}
        placeholder={tableName || 'Table caption'}
        isReadOnly={readOnly}
        onChange={(value) => onCaptionChange?.(value || undefined)}
      />
    </BlockHeader>
  );
};
