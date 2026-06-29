import {useDataTable, type DataTable} from '@sqlrooms/db';
import {
  blockDocumentContentToBlocks,
  type BlockDocumentStatefulBlockBlock,
  type BlockSettingsComponentProps,
  useStoreWithBlockDocuments,
} from '@sqlrooms/documents';
import {type FC, useMemo} from 'react';
import {DataTableSettingsPanel} from '../DataTableSettingsPanel';

function useDataTableBlock(
  documentId: string | undefined,
  blockId: string | undefined,
): BlockDocumentStatefulBlockBlock | undefined {
  const artifact = useStoreWithBlockDocuments((state) =>
    documentId ? state.blockDocuments.config.artifacts[documentId] : undefined,
  );

  return useMemo(() => {
    if (!artifact || !documentId || !blockId) return undefined;

    return blockDocumentContentToBlocks(artifact.content).find(
      (block): block is BlockDocumentStatefulBlockBlock =>
        block.id === blockId &&
        block.type === 'statefulBlock' &&
        block.blockType === 'data-table',
    );
  }, [artifact, documentId, blockId]);
}

/**
 * Settings adapter for a Mosaic data-table explorer block inside a block document.
 */
export const DataTableBlockSettings: FC<BlockSettingsComponentProps> = ({
  blockId,
  dashboardId,
}) => {
  const dataTableBlock = useDataTableBlock(dashboardId, blockId);
  const updateBlock = useStoreWithBlockDocuments(
    (state) => state.blockDocuments.updateBlock,
  );
  const dataTable = useDataTable(dataTableBlock?.title);

  if (!dataTableBlock || !dashboardId) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-muted-foreground text-sm">
          Data table block not found
        </p>
      </div>
    );
  }

  const handleTableChange = (table: DataTable) => {
    updateBlock(dashboardId, blockId, {
      ...dataTableBlock,
      title: table.table.toString(),
    });
  };

  const handleCaptionChange = (caption: string) => {
    updateBlock(dashboardId, blockId, {
      ...dataTableBlock,
      caption: caption || undefined,
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
