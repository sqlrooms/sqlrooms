import {
  RoomPanelComponent,
  TabsLayout,
  useLayoutNodeContext,
} from '@sqlrooms/layout';
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
import {PencilIcon, SparklesIcon, TrashIcon} from 'lucide-react';
import {useCallback, useEffect, useState} from 'react';
import {ARTIFACT_TYPES, ArtifactTypeInfo} from '../artifactTypes';
import {useRoomStore} from '../store';

export const ArtifactsContainerPanel: RoomPanelComponent = () => {
  const executeCommand = useRoomStore((s) => s.commands.executeCommand);
  const ctx = useLayoutNodeContext();
  const nodeId = ctx.containerType === 'tabs' ? ctx.node.id : undefined;
  const addTab = useRoomStore((s) => s.layout.addTab);
  const getActiveTab = useRoomStore((s) => s.layout.getActiveTab);
  const removeTab = useRoomStore((s) => s.layout.removeTab);
  const artifacts = useRoomStore((s) => s.artifacts.config.itemsById);
  const setCurrentItem = useRoomStore((s) => s.artifacts.setCurrentItem);
  const evictDashboardRuntime = useRoomStore(
    (s) => s.mosaicDashboard.evictDashboardRuntime,
  );
  const toggleCollapsed = useRoomStore((s) => s.layout.toggleCollapsed);
  const isAssistantCollapsed = useRoomStore((s) =>
    s.layout.isCollapsed('assistant-sidebar'),
  );

  const [deleteConfirm, setDeleteConfirm] = useState<{
    tabId: string;
    tabName: string;
  } | null>(null);

  const activeArtifactId = nodeId ? getActiveTab(nodeId) : undefined;

  useEffect(() => {
    if (typeof activeArtifactId !== 'string') {
      setCurrentItem(undefined);
      return;
    }
    const artifact = artifacts[activeArtifactId];
    if (!artifact) {
      setCurrentItem(undefined);
      return;
    }
    setCurrentItem(activeArtifactId);
  }, [activeArtifactId, artifacts, setCurrentItem]);

  const handleAddArtifact = useCallback(
    async (info: ArtifactTypeInfo) => {
      const result = await executeCommand(info.addCommand, {
        title: `New ${info.title}`,
      });
      if (result?.success && nodeId) {
        const artifactId = (result.data as {artifactId?: string}).artifactId;
        if (!artifactId) {
          return;
        }
        addTab(nodeId, {
          type: 'panel',
          id: artifactId,
          panel: {
            key: 'artifact',
            meta: {artifactId},
          },
        });
      }
    },
    [addTab, executeCommand, nodeId],
  );

  const handleDeleteTab = useCallback((tabId: string, tabName: string) => {
    setDeleteConfirm({tabId, tabName});
  }, []);

  const closeTabWithCleanup = useCallback(
    (tabId: string) => {
      if (!nodeId) return;
      const artifact = artifacts[tabId];
      if (artifact?.type === 'dashboard') {
        evictDashboardRuntime(tabId, {resetSelection: true});
      }
      removeTab(nodeId, tabId);
    },
    [artifacts, evictDashboardRuntime, nodeId, removeTab],
  );

  const confirmDelete = useCallback(() => {
    if (deleteConfirm) {
      closeTabWithCleanup(deleteConfirm.tabId);
    }
    setDeleteConfirm(null);
  }, [closeTabWithCleanup, deleteConfirm]);

  // const handleRenameArtifact = useCallback(
  //   (_artifactId: string, _newName: string) => {
  //     // renameArtifact(artifactId, newName);
  //   },
  //   [],
  // );

  return (
    <>
      <TabsLayout.TabStrip
        closeable={true}
        preventCloseLastTab={false}
        onClose={closeTabWithCleanup}
        renderTabMenu={(tab) => (
          <>
            <TabStrip.MenuItem
              disabled
              // onClick={() => handleRenameArtifact(tab.id, tab.name)}
            >
              <PencilIcon className="mr-2 h-4 w-4" />
              Rename
            </TabStrip.MenuItem>
            <TabStrip.MenuSeparator />
            <TabStrip.MenuItem
              disabled
              variant="destructive"
              onClick={() => handleDeleteTab(tab.id, tab.name)}
            >
              <TrashIcon className="mr-2 h-4 w-4" />
              Delete
            </TabStrip.MenuItem>
          </>
        )}
      >
        <TabsLayout.SearchDropdown />
        <TabsLayout.Tabs />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <TabStrip.NewButton aria-label="Add chart to dashboard" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {Object.values(ARTIFACT_TYPES).map((type) => (
              <DropdownMenuItem
                key={type.title}
                onClick={() => handleAddArtifact(type)}
              >
                <type.icon /> {`New ${type.title}`}
              </DropdownMenuItem>
            ))}
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
      </TabsLayout.TabStrip>
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
            <DialogTitle>Delete artifact tab</DialogTitle>
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
