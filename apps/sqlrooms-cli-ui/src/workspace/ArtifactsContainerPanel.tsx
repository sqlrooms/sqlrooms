import {RoomPanelComponent, TabsLayout} from '@sqlrooms/layout';
import {useArtifactTabs} from '@sqlrooms/artifacts';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  TabStrip,
} from '@sqlrooms/ui';
import {PencilIcon, PlusIcon, SparklesIcon, TrashIcon} from 'lucide-react';
import {useCallback, useState} from 'react';
import {ARTIFACT_TYPES, CLI_ARTIFACT_TYPES} from '../artifactTypes';
import {useRoomStore} from '../store';

export const ArtifactsContainerPanel: RoomPanelComponent = () => {
  const toggleCollapsed = useRoomStore((s) => s.layout.toggleCollapsed);
  const isAssistantCollapsed = useRoomStore((s) =>
    s.layout.isCollapsed('assistant-sidebar'),
  );
  const artifactTabs = useArtifactTabs({
    types: CLI_ARTIFACT_TYPES,
    panelKey: 'artifact',
  });

  const [deleteConfirm, setDeleteConfirm] = useState<{
    tabId: string;
    tabName: string;
  } | null>(null);

  const handleDeleteTab = useCallback((tabId: string, tabName: string) => {
    setDeleteConfirm({tabId, tabName});
  }, []);

  const confirmDelete = useCallback(() => {
    if (deleteConfirm) {
      artifactTabs.deleteArtifact(deleteConfirm.tabId);
    }
    setDeleteConfirm(null);
  }, [artifactTabs, deleteConfirm]);

  return (
    <>
      <TabStrip
        tabs={artifactTabs.tabs}
        openTabs={artifactTabs.openTabs}
        selectedTabId={artifactTabs.selectedTabId}
        closeable={true}
        preventCloseLastTab={false}
        onClose={artifactTabs.closeArtifact}
        onOpenTabsChange={artifactTabs.handleOpenTabsChange}
        onSelect={artifactTabs.selectArtifact}
        onRename={artifactTabs.renameArtifact}
        renderTabMenu={(tab) => (
          <>
            <TabStrip.MenuItem disabled>
              <PencilIcon className="mr-2 h-4 w-4" />
              Rename
            </TabStrip.MenuItem>
            <TabStrip.MenuSeparator />
            <TabStrip.MenuItem
              variant="destructive"
              onClick={() => handleDeleteTab(tab.id, tab.name)}
            >
              <TrashIcon className="mr-2 h-4 w-4" />
              Delete
            </TabStrip.MenuItem>
          </>
        )}
      >
        <TabStrip.SearchDropdown />
        <TabStrip.Tabs />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <TabStrip.Button aria-label="Create new artifact">
              <PlusIcon className="h-4 w-4" />
            </TabStrip.Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {CLI_ARTIFACT_TYPES.map((artifactType) => {
              const type = ARTIFACT_TYPES[artifactType];
              return (
                <DropdownMenuItem
                  key={artifactType}
                  onClick={() => artifactTabs.createArtifact(artifactType)}
                >
                  <type.icon /> {`New ${type.label}`}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex-1" />
        {isAssistantCollapsed ? (
          <TabStrip.Button
            className="w-auto text-xs uppercase"
            onClick={() => toggleCollapsed('assistant-sidebar')}
          >
            <SparklesIcon className="h-4 w-4" /> AI
          </TabStrip.Button>
        ) : null}
      </TabStrip>
      <TabsLayout.TabContentContainer>
        <TabsLayout.TabContent />
      </TabsLayout.TabContentContainer>
      <Dialog
        open={deleteConfirm !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirm(null);
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
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
