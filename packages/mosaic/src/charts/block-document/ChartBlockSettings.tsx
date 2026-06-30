import {useDataTable, type DataTable} from '@sqlrooms/db';
import type {
  BlockDocumentChartBlock,
  BlockSettingsComponentProps,
} from '@sqlrooms/documents';
import {
  blockDocumentContentToBlocks,
  useStoreWithBlockDocuments,
} from '@sqlrooms/documents';
import {type FC, useMemo} from 'react';
import {type ChartConfig} from '../chart-types/chart-config';
import {ChartSettingsPanel} from '../ChartSettingsPanel';

function useChartBlock(
  documentId: string | undefined,
  blockId: string | undefined,
): BlockDocumentChartBlock | undefined {
  const artifact = useStoreWithBlockDocuments((state) =>
    documentId ? state.blockDocuments.config.artifacts[documentId] : undefined,
  );

  return useMemo(() => {
    if (!artifact || !documentId || !blockId) return undefined;

    const blocks = blockDocumentContentToBlocks(artifact.content);

    return blocks.find(
      (block): block is BlockDocumentChartBlock =>
        block.id === blockId && block.type === 'chart',
    );
  }, [artifact, documentId, blockId]);
}

/**
 * Settings adapter for a Mosaic chart block inside a block document.
 */
export const ChartBlockSettings: FC<BlockSettingsComponentProps> = ({
  blockId,
  dashboardId,
  readOnly,
  onClose,
}) => {
  const chartBlock = useChartBlock(dashboardId, blockId);
  const updateBlock = useStoreWithBlockDocuments(
    (state) => state.blockDocuments.updateBlock,
  );
  const dataTable = useDataTable(chartBlock?.tableName);

  if (!chartBlock || !dashboardId) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-muted-foreground text-sm">Chart block not found</p>
      </div>
    );
  }

  const handleConfigChange = (config: ChartConfig) => {
    if (readOnly) return;
    updateBlock(dashboardId, blockId, {
      ...chartBlock,
      config,
    });
  };

  const handleTableChange = (table: DataTable) => {
    if (readOnly) return;
    updateBlock(dashboardId, blockId, {
      ...chartBlock,
      tableName: table.table.toString(),
    });
  };

  const handleCaptionChange = (caption: string) => {
    if (readOnly) return;
    updateBlock(dashboardId, blockId, {
      ...chartBlock,
      caption: caption || undefined,
    });
  };

  return (
    <ChartSettingsPanel
      dataTable={dataTable}
      config={(chartBlock.config || {}) as ChartConfig}
      onConfigChange={handleConfigChange}
      onTableChange={handleTableChange}
      title={chartBlock.caption || ''}
      onTitleChange={handleCaptionChange}
      readOnly={readOnly}
      onClose={onClose}
    />
  );
};
