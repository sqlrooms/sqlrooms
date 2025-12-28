import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  TabStrip,
} from '@sqlrooms/ui';
import {useRoomStore} from '../store';
import {PencilIcon, Trash2Icon, UploadIcon} from 'lucide-react';
import {FC, useCallback, useState} from 'react';
import {
  KeplerImageExport,
  KeplerMapContainer,
  KeplerPlotContainer,
  KeplerProvider,
  useKeplerStateActions,
} from '@sqlrooms/kepler';

/**
 * Export image dialog content for a specific map.
 */
const ExportImageDialogContent: FC<{mapId: string; fileName: string}> = ({
  mapId,
  fileName,
}) => {
  const {keplerActions, keplerState} = useKeplerStateActions({mapId});
  const exportImageSettings = keplerState?.uiState?.exportImage;

  if (!exportImageSettings) {
    return null;
  }

  return (
    <KeplerProvider mapId={mapId}>
      <KeplerImageExport
        fileName={fileName}
        exportImageSettings={exportImageSettings}
        setExportImageSetting={
          keplerActions.uiStateActions.setExportImageSetting
        }
        cleanupExportImage={keplerActions.uiStateActions.cleanupExportImage}
      />
    </KeplerProvider>
  );
};

export const KeplerMapsContainer: FC<{
  className?: string;
}> = () => {
  const maps = useRoomStore((state) => state.kepler.config.maps);
  const openTabs = useRoomStore((state) => state.kepler.config.openTabs);
  const currentMap = useRoomStore((state) => state.kepler.getCurrentMap());
  const setCurrentMapId = useRoomStore((state) => state.kepler.setCurrentMapId);
  const createMap = useRoomStore((state) => state.kepler.createMap);
  const renameMap = useRoomStore((state) => state.kepler.renameMap);
  const deleteMap = useRoomStore((state) => state.kepler.deleteMap);
  const closeMap = useRoomStore((state) => state.kepler.closeMap);
  const setOpenTabs = useRoomStore((state) => state.kepler.setOpenTabs);

  const [mapToDelete, setMapToDelete] = useState<string | null>(null);
  const [mapToExport, setMapToExport] = useState<string | null>(null);
  const [mapToRename, setMapToRename] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const handleCreateMap = () => {
    const newMapId = createMap();
    setCurrentMapId(newMapId);
  };

  const handleDeleteMap = useCallback(() => {
    if (mapToDelete) {
      deleteMap(mapToDelete);
      setMapToDelete(null);
    }
  }, [mapToDelete, deleteMap]);

  const handleRenameRequest = useCallback(
    (mapId: string) => {
      const map = maps.find((m) => m.id === mapId);
      if (map) {
        setMapToRename({id: mapId, name: map.name});
        setRenameValue(map.name);
      }
    },
    [maps],
  );

  const handleConfirmRename = useCallback(() => {
    if (mapToRename && renameValue.trim()) {
      renameMap(mapToRename.id, renameValue.trim());
    }
    setMapToRename(null);
  }, [mapToRename, renameValue, renameMap]);

  const mapToDeleteData = mapToDelete
    ? maps.find((m) => m.id === mapToDelete)
    : null;
  const mapToExportData = mapToExport
    ? maps.find((m) => m.id === mapToExport)
    : null;

  return (
    <>
      <div className="flex h-full w-full flex-col">
        <TabStrip
          className="bg-muted items-center pt-1"
          tabs={maps}
          preventCloseLastTab
          openTabs={openTabs}
          onOpenTabsChange={setOpenTabs}
          selectedTabId={currentMap?.id}
          onSelect={setCurrentMapId}
          onCreate={handleCreateMap}
          onRename={renameMap}
          onClose={closeMap}
          renderSearchItemActions={(tab) => (
            <>
              <TabStrip.SearchItemAction
                icon={<PencilIcon className="h-3 w-3" />}
                aria-label={`Rename ${tab.name}`}
                onClick={() => handleRenameRequest(tab.id)}
              />
              {maps.length > 1 && (
                <TabStrip.SearchItemAction
                  icon={<Trash2Icon className="h-3 w-3" />}
                  aria-label={`Delete ${tab.name}`}
                  onClick={() => setMapToDelete(tab.id)}
                />
              )}
            </>
          )}
          renderTabMenu={(tab) => (
            <>
              <TabStrip.MenuItem onClick={() => setMapToExport(tab.id)}>
                <UploadIcon className="mr-2 h-4 w-4" />
                Export map
              </TabStrip.MenuItem>
              <TabStrip.MenuSeparator />
              <TabStrip.MenuItem onClick={() => handleRenameRequest(tab.id)}>
                <PencilIcon className="mr-2 h-4 w-4" />
                Rename
              </TabStrip.MenuItem>
              {maps.length > 1 && (
                <>
                  <TabStrip.MenuSeparator />
                  <TabStrip.MenuItem
                    variant="destructive"
                    onClick={() => setMapToDelete(tab.id)}
                  >
                    <Trash2Icon className="mr-2 h-4 w-4" />
                    Delete map
                  </TabStrip.MenuItem>
                </>
              )}
            </>
          )}
        >
          <TabStrip.SearchDropdown />
          <TabStrip.Tabs />
          <TabStrip.NewButton tooltip="Create new map" />
        </TabStrip>

        {/* Map content area */}
        <div className="relative flex-1">
          {maps.map((map) => (
            <div
              key={map.id}
              className={`absolute inset-0 ${currentMap?.id === map.id ? '' : 'hidden'}`}
            >
              <KeplerMapContainer mapId={map.id} />
            </div>
          ))}
        </div>
      </div>

      <KeplerPlotContainer mapId={currentMap?.id || ''} logoComponent={null} />

      {/* Delete confirmation dialog */}
      <Dialog
        open={mapToDelete !== null}
        onOpenChange={(open) => !open && setMapToDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Map</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{mapToDeleteData?.name}
              &rdquo;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMapToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteMap}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export image dialog */}
      <Dialog
        open={mapToExport !== null}
        onOpenChange={(open) => !open && setMapToExport(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Map as Image</DialogTitle>
          </DialogHeader>
          {mapToExportData && (
            <ExportImageDialogContent
              mapId={mapToExportData.id}
              fileName={mapToExportData.name}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog
        open={mapToRename !== null}
        onOpenChange={(open) => !open && setMapToRename(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Map</DialogTitle>
            <DialogDescription>Enter a new name for the map.</DialogDescription>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder="Enter map name"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleConfirmRename();
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setMapToRename(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmRename}
              disabled={!renameValue.trim()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
