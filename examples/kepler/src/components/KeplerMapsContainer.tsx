import {
  Button,
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
import {useProjectStore} from '../store';
import {PlusIcon, Trash2Icon} from 'lucide-react';
import {useState} from 'react';
import {KeplerMapContainer} from '@sqlrooms/kepler';

export function KeplerMapsContainer() {
  const maps = useProjectStore((state) => state.config.kepler.maps);
  const currentMap = useProjectStore((state) => state.kepler.getCurrentMap());
  const setCurrentMapId = useProjectStore(
    (state) => state.kepler.setCurrentMapId,
  );
  const createMap = useProjectStore((state) => state.kepler.createMap);
  const renameMap = useProjectStore((state) => state.kepler.renameMap);
  const deleteMap = useProjectStore((state) => state.kepler.deleteMap);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

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
    <>
      <Tabs
        value={currentMap?.id}
        onValueChange={setCurrentMapId}
        className="h-full w-full"
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
              onClick={() => createMap()}
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
          <TabsContent key={map.id} value={map.id} className="h-full w-full">
            <KeplerMapContainer mapId={map.id} />
          </TabsContent>
        ))}
      </Tabs>

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
    </>
  );
}
