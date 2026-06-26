import {useDataTable, type DataTable} from '@sqlrooms/db';
import type {BlockSettingsComponentProps} from '@sqlrooms/documents';
import {useRoomStore} from '../../store';
import {FC} from 'react';
import {useDataTableBlock} from './useDataTableBlock';
import {DataTableSettingsPanel} from '@sqlrooms/mosaic';

export const BlockDataTableSettings: FC<BlockSettingsComponentProps> = ({
  blockId,
  dashboardId,
}) => {
  // For standalone data table blocks (in worksheets)
  const dataTableBlock = useDataTableBlock(dashboardId, blockId);
  const updateBlock = useRoomStore((state) => state.blockDocuments.updateBlock);

  if (!dataTableBlock) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-muted-foreground text-sm">
          Data table block not found
        </p>
      </div>
    );
  }

  const tableName = dataTableBlock.title;
  const dataTable = useDataTable(tableName);

  const handleTableChange = (table: DataTable) => {
    updateBlock(dashboardId!, blockId, {
      ...dataTableBlock,
      title: table.table.toString(),
    });
  };

  const handleCaptionChange = (newCaption: string) => {
    updateBlock(dashboardId!, blockId, {
      ...dataTableBlock,
      caption: newCaption || undefined,
    });
  };

  return (
    <DataTableSettingsPanel
      value={dataTable}
      onChange={handleTableChange}
      title={dataTableBlock.caption || ''}
      onTitleChange={handleCaptionChange}
    />
  );
};
