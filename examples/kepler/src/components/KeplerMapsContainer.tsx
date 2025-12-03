import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EditableText,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@sqlrooms/ui';
import {useRoomStore} from '../store';
import {PlusIcon, Trash2Icon} from 'lucide-react';
import {FC, useState} from 'react';
import {KeplerMapContainer, KeplerPlotContainer} from '@sqlrooms/kepler';

export const KeplerMapsContainer: FC<{
  className?: string;
}> = ({className}) => {
  const maps = useRoomStore((state) => state.kepler.config.maps);
  const currentMap = useRoomStore((state) => state.kepler.getCurrentMap());
  const setCurrentMapId = useRoomStore((state) => state.kepler.setCurrentMapId);
  const createMap = useRoomStore((state) => state.kepler.createMap);
  const renameMap = useRoomStore((state) => state.kepler.renameMap);
  const deleteMap = useRoomStore((state) => state.kepler.deleteMap);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const handleCreateMap = () => {
    const newMapId = createMap();
    setCurrentMapId(newMapId);
  };
  const handleDeleteMap = () => {
    if (currentMap) {
      deleteMap(currentMap.id);
      setIsDeleteDialogOpen(false);
      // If there are other maps, select the first one
      if (maps.length > 1) {
        const nextMap = maps.find((m) => m.id !== currentMap.id);
        if (nextMap) {
          setCurrentMapId(nextMap.id);
        }
      }
    }
  };

  return (
    <div className={cn('relative flex h-full w-full flex-col', className)}>
      <Tabs
        value={currentMap?.id}
        onValueChange={setCurrentMapId}
        className="absolute inset-0 flex h-full w-full flex-col"
      >
        <TabsList className="flex items-center gap-1">
          {maps.map((map) => (
            <TabsTrigger
              key={map.id}
              value={map.id}
              className="flex items-center gap-2"
            >
              <EditableText
                value={map.name}
                onChange={(newName) => renameMap(map.id, newName)}
                className="min-w-[100px]"
              />
            </TabsTrigger>
          ))}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCreateMap}
              className="h-8 w-8 shrink-0"
            >
              <PlusIcon className="h-4 w-4" />
            </Button>
            {maps.length > 1 && currentMap && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsDeleteDialogOpen(true)}
                className="text-destructive h-8 w-8 shrink-0"
              >
                <Trash2Icon className="h-4 w-4" />
              </Button>
            )}
          </div>
        </TabsList>
        {maps.map((map) => (
          <TabsContent
            key={map.id}
            value={map.id}
            className="h-full w-full data-[state=inactive]:hidden"
            forceMount
          >
            <KeplerMapContainer mapId={map.id} />
          </TabsContent>
        ))}
      </Tabs>
      <KeplerPlotContainer mapId={currentMap?.id ?? ''} />
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Map</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{currentMap?.name}"? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteMap}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
