import type {DataTable} from '@sqlrooms/duckdb';
import {
  blockDocumentContentToBlocks,
  type BlockDocumentStatefulBlockBlock,
  type BlockSettingsComponentProps,
  useStoreWithBlockDocuments,
} from '@sqlrooms/documents';
import {useStoreWithMosaicDashboard} from '@sqlrooms/mosaic';
import {type FC, useCallback, useMemo} from 'react';
import {DECK_MAP_DASHBOARD_PANEL_TYPE} from './dashboardConfig';
import {MapSettingsPanel} from './MapSettings';

function useMapBlock(
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
        block.blockType === 'map',
    );
  }, [artifact, documentId, blockId]);
}

/**
 * Settings adapter for an embeddable Deck map block inside a block document.
 */
export const DeckMapBlockSettings: FC<BlockSettingsComponentProps> = ({
  blockId,
  dashboardId,
  blockInstanceId,
  readOnly,
}) => {
  const mapId = blockInstanceId ?? blockId;
  const mapBlock = useMapBlock(dashboardId, blockId);
  const dashboard = useStoreWithMosaicDashboard((state) =>
    state.mosaicDashboard.getDashboard(mapId),
  );
  const updateBlock = useStoreWithBlockDocuments(
    (state) => state.blockDocuments.updateBlock,
  );
  const setSelectedTable = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.setSelectedTable,
  );

  const panel = useMemo(
    () =>
      dashboard?.panels.find(
        (candidate) => candidate.type === DECK_MAP_DASHBOARD_PANEL_TYPE,
      ),
    [dashboard?.panels],
  );

  const handleTableChange = useCallback(
    (table: DataTable) => {
      if (readOnly) return;
      setSelectedTable(mapId, table.table.toString());
    },
    [mapId, readOnly, setSelectedTable],
  );

  const handleTitleChange = useCallback(
    (title: string) => {
      if (readOnly) return;
      if (dashboardId && mapBlock) {
        updateBlock(dashboardId, blockId, {
          ...mapBlock,
          caption: title || undefined,
        });
      }
    },
    [dashboardId, blockId, mapBlock, readOnly, updateBlock],
  );

  if (!dashboard || !panel) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-muted-foreground text-sm">
          Map settings not available
        </p>
      </div>
    );
  }

  const panelWithCaption = {
    ...panel,
    title: mapBlock?.caption ?? panel.title,
  };

  return (
    <MapSettingsPanel
      dashboardId={mapId}
      panel={panelWithCaption}
      onTableChange={handleTableChange}
      onTitleChange={handleTitleChange}
      readOnly={readOnly}
    />
  );
};
