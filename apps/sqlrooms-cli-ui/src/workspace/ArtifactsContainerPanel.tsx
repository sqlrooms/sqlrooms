import {ArtifactTabs} from '@sqlrooms/artifacts';
import {RoomPanelComponent} from '@sqlrooms/layout';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenuItem,
} from '@sqlrooms/ui';
import {PencilIcon, SparklesIcon, TrashIcon} from 'lucide-react';
import {useCallback, useState} from 'react';
import {ARTIFACT_TYPES, CLI_ARTIFACT_TYPES} from '../artifactTypes';
import {useRoomStore} from '../store';

export const ArtifactsContainerPanel: RoomPanelComponent = () => {
  const [deleteConfirm, setDeleteConfirm] = useState<{
    tabId: string;
    tabName: string;
  } | null>(null);

  const handleDeleteTab = useCallback((tabId: string, tabName: string) => {
    setDeleteConfirm({tabId, tabName});
  }, []);

  return (
    <ArtifactTabs
      types={CLI_ARTIFACT_TYPES}
      panelKey="artifact"
      closeable={true}
      preventCloseLastTab={false}
      renderTabMenu={(tab) => (
        <>
          <ArtifactTabs.MenuItem disabled>
            <PencilIcon className="mr-2 h-4 w-4" />
            Rename
          </ArtifactTabs.MenuItem>
          <ArtifactTabs.MenuSeparator />
          <ArtifactTabs.MenuItem
            variant="destructive"
            onClick={() => handleDeleteTab(tab.id, tab.name)}
          >
            <TrashIcon className="mr-2 h-4 w-4" />
            Delete
          </ArtifactTabs.MenuItem>
        </>
      )}
      overlay={
        <DeleteArtifactDialog
          deleteConfirm={deleteConfirm}
          onClear={() => setDeleteConfirm(null)}
        />
      }
    >
      <ArtifactTabs.SearchDropdown />
      <ArtifactTabs.Tabs />
      <CliArtifactAddMenu />
      <div className="flex-1" />
      <AssistantToggleButton />
    </ArtifactTabs>
  );
};

function CliArtifactAddMenu() {
  return (
    <ArtifactTabs.AddMenu>
      {(artifactTabs) =>
        CLI_ARTIFACT_TYPES.map((artifactType) => {
          const type = ARTIFACT_TYPES[artifactType];
          return (
            <DropdownMenuItem
              key={artifactType}
              onClick={() => artifactTabs.createArtifact(artifactType)}
            >
              <type.icon /> {`New ${type.label}`}
            </DropdownMenuItem>
          );
        })
      }
    </ArtifactTabs.AddMenu>
  );
}

function AssistantToggleButton() {
  const toggleCollapsed = useRoomStore((s) => s.layout.toggleCollapsed);
  const isAssistantCollapsed = useRoomStore((s) =>
    s.layout.isCollapsed('assistant-sidebar'),
  );

  if (!isAssistantCollapsed) {
    return null;
  }

  return (
    <ArtifactTabs.Button
      className="w-auto text-xs uppercase"
      onClick={() => toggleCollapsed('assistant-sidebar')}
    >
      <SparklesIcon className="h-4 w-4" /> AI
    </ArtifactTabs.Button>
  );
}

function DeleteArtifactDialog({
  deleteConfirm,
  onClear,
}: {
  deleteConfirm: {tabId: string; tabName: string} | null;
  onClear: () => void;
}) {
  const artifactTabs = ArtifactTabs.useActions();

  const confirmDelete = useCallback(() => {
    if (deleteConfirm) {
      artifactTabs.deleteArtifact(deleteConfirm.tabId);
    }
    onClear();
  }, [artifactTabs, deleteConfirm, onClear]);

  return (
    <Dialog
      open={deleteConfirm !== null}
      onOpenChange={(open) => {
        if (!open) onClear();
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Delete artifact</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete &ldquo;
            {deleteConfirm?.tabName}&rdquo;? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClear}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirmDelete}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
