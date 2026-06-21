import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EditableText,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@sqlrooms/ui';
import {Plus, Trash2Icon} from 'lucide-react';
import {useCallback, useState} from 'react';
import {useRoomStore} from '../store';
import {CliAssistantToggleButton, CliSidebarToggleButton} from './sidebar';

export function CliWorkspaceTopbar() {
  const roomTitle = useRoomStore((state) => state.room.config.title);
  const setRoomTitle = useRoomStore((state) => state.room.setRoomTitle);
  const currentArtifactId = useRoomStore(
    (state) => state.artifacts.config.currentArtifactId,
  );
  const currentArtifact = useRoomStore((state) =>
    currentArtifactId
      ? state.artifacts.config.artifactsById[currentArtifactId]
      : undefined,
  );
  const renameArtifact = useRoomStore(
    (state) => state.artifacts.renameArtifact,
  );
  const setShowArtifactChooser = useRoomStore(
    (state) => state.workspaceUi.setShowArtifactChooser,
  );
  const deleteArtifact = useRoomStore(
    (state) => state.artifacts.deleteArtifact,
  );
  const deleteTab = useRoomStore((state) => state.layout.deleteTab);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const handleTitleChange = useCallback(
    (nextTitle: string) => {
      const trimmedTitle = nextTitle.trim();
      if (trimmedTitle) {
        setRoomTitle(trimmedTitle);
      }
    },
    [setRoomTitle],
  );

  const handleArtifactTitleChange = useCallback(
    (nextTitle: string) => {
      const trimmedTitle = nextTitle.trim();
      if (currentArtifactId && trimmedTitle) {
        renameArtifact(currentArtifactId, trimmedTitle);
      }
    },
    [currentArtifactId, renameArtifact],
  );

  const handleConfirmDelete = useCallback(() => {
    if (currentArtifactId) {
      deleteArtifact(currentArtifactId);
      deleteTab('workspace', currentArtifactId);
    }
    setDeleteConfirmOpen(false);
  }, [currentArtifactId, deleteArtifact, deleteTab]);

  return (
    <header className="border-border bg-background/95 grid h-12 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b px-3">
      <div className="flex min-w-0 items-center gap-1.5">
        <CliSidebarToggleButton />
        <CliAssistantToggleButton />
      </div>
      <div className="flex max-w-[min(48rem,58vw)] min-w-0 items-center justify-center gap-1 text-center">
        <EditableText
          value={roomTitle}
          onChange={handleTitleChange}
          placeholder="Untitled Workspace"
          selectOnFocus
          className="text-foreground hover:bg-accent h-10 max-w-[24rem] min-w-0 border-transparent text-right text-2xl leading-none font-bold shadow-none ring-0 focus-visible:ring-1"
        />
        {currentArtifact ? (
          <>
            <span className="text-muted-foreground shrink-0 text-2xl leading-none font-semibold">
              /
            </span>
            <EditableText
              value={currentArtifact.title}
              onChange={handleArtifactTitleChange}
              placeholder="Untitled item"
              selectOnFocus
              className="text-foreground hover:bg-accent h-10 max-w-[20rem] min-w-0 border-transparent text-left text-2xl leading-none font-bold shadow-none ring-0 focus-visible:ring-1"
            />
          </>
        ) : null}
      </div>
      <div className="flex min-w-0 items-center justify-end gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive size-8"
                disabled={!currentArtifact}
                aria-label="Delete item"
                onClick={() => setDeleteConfirmOpen(true)}
              >
                <Trash2Icon className="h-4 w-4" aria-hidden />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {currentArtifact ? 'Delete item' : 'No item selected'}
          </TooltipContent>
        </Tooltip>
        <Button
          type="button"
          size="sm"
          className="h-8 gap-1.5 px-2 sm:px-3"
          aria-label="New"
          onClick={() => setShowArtifactChooser(true)}
        >
          <Plus className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">New</span>
        </Button>
      </div>
      <DeleteCurrentArtifactDialog
        artifactTitle={currentArtifact?.title}
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        onConfirm={handleConfirmDelete}
      />
    </header>
  );
}

function DeleteCurrentArtifactDialog({
  artifactTitle,
  open,
  onOpenChange,
  onConfirm,
}: {
  artifactTitle?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Delete item</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete &ldquo;
            {artifactTitle ?? 'this item'}&rdquo;? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
