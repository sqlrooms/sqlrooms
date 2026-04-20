import {
  LayoutPanelNode,
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
import {useCallback, useState} from 'react';
import {ARTIFACT_TYPES, ArtifactTypeInfo} from '../artifactTypes';
import {useRoomStore} from '../store';

export const ArtifactsContainerPanel: RoomPanelComponent = () => {
  const executeCommand = useRoomStore((s) => s.commands.executeCommand);
  const ctx = useLayoutNodeContext();
  const nodeId = ctx.containerType === 'tabs' ? ctx.node.id : undefined;
  const addTab = useRoomStore((s) => s.layout.addTab);
  const deleteTab = useRoomStore((s) => s.layout.deleteTab);
  const toggleCollapsed = useRoomStore((s) => s.layout.toggleCollapsed);
  const isAssistantCollapsed = useRoomStore((s) =>
    s.layout.isCollapsed('assistant'),
  );

  const [deleteConfirm, setDeleteConfirm] = useState<{
    tabId: string;
    tabName: string;
  } | null>(null);

  const handleAddSheet = useCallback(async (info: ArtifactTypeInfo) => {
    const result = await executeCommand(info.addCommand, {
      title: `New ${info.title}`,
    });
    if (result?.success && nodeId) {
      const {sheetId} = result.data as {sheetId: string};
      const panelNode: LayoutPanelNode = {
        type: 'panel',
        id: sheetId,
        panel: {key: 'workspace/{artifactId}', meta: {artifactId: sheetId}},
      };
      addTab(nodeId, panelNode);
    }
  }, []);

  const handleDeleteTab = useCallback((tabId: string, tabName: string) => {
    setDeleteConfirm({tabId, tabName});
  }, []);

  const confirmDelete = useCallback(() => {
    if (deleteConfirm && nodeId) {
      deleteTab(nodeId, deleteConfirm.tabId);
    }
    setDeleteConfirm(null);
  }, [deleteConfirm, nodeId, deleteTab]);

  const handleRenameSheet = useCallback(
    (_sheetId: string, _newName: string) => {
      // renameSheet(sheetId, newName);
    },
    [],
  );

  return (
    <>
      <TabsLayout.TabStrip
        closeable={true}
        preventCloseLastTab={false}
        renderTabMenu={(tab) => (
          <>
            <TabStrip.MenuItem
              onClick={() => handleRenameSheet(tab.id, tab.name)}
            >
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
                onClick={() => handleAddSheet(type)}
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
            onClick={() => toggleCollapsed('assistant')}
          >
            <SparklesIcon className="h-4 w-4" /> AI
          </TabStrip.Button>
        ) : null}
      </TabsLayout.TabStrip>
      <TabsLayout.TabContent />
      <Dialog
        open={deleteConfirm !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirm(null);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete sheet</DialogTitle>
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
