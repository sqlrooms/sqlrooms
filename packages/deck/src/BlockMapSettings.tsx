import {getTableIdentity, type DataTable} from '@sqlrooms/duckdb';
import {
  blockDocumentContentToBlocks,
  type BlockDocumentStatefulBlockBlock,
  type BlockSettingsComponentProps,
  useStoreWithBlockDocuments,
} from '@sqlrooms/documents';
import {useStoreWithMosaicDashboard} from '@sqlrooms/mosaic';
import {Button} from '@sqlrooms/ui';
import {XIcon} from 'lucide-react';
import {type FC, useCallback, useMemo} from 'react';
import {
  DECK_MAP_DASHBOARD_PANEL_TYPE,
  type DeckMapDashboardPanelConfig,
} from './dashboardConfig';
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
  onClose,
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
      setSelectedTable(mapId, getTableIdentity(table.table));
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

  const isCustomMode =
    (panel.config as DeckMapDashboardPanelConfig)?.configMode === 'custom';

  if (isCustomMode) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b px-3 py-1.5 text-xs font-medium">
          <span>Map settings</span>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={onClose}
              aria-label="Close"
            >
              <XIcon className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        <div className="text-muted-foreground flex flex-1 items-center justify-center p-4 text-center text-sm">
          <p>
            This map uses a custom AI-generated configuration.
            <br />
            Use the JSON editor to make changes.
          </p>
        </div>
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
      onClose={onClose}
      onTableChange={handleTableChange}
      onTitleChange={handleTitleChange}
      readOnly={readOnly}
    />
  );
};
