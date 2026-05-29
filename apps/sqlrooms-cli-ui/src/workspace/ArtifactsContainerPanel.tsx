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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  toast,
} from '@sqlrooms/ui';
import {
  BarChart3Icon,
  PencilIcon,
  PlusIcon,
  SparklesIcon,
  TrashIcon,
} from 'lucide-react';
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
      forceMountContent
      dndMode="shared"
      dndScopeId="cli-artifact-tabs"
      fontSize={13}
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
  const artifactTabs = ArtifactTabs.useActions();
  const invokeCommand = useRoomStore((state) => state.commands.invokeCommand);

  const invokeCreateArtifactCommand = useCallback(
    async (commandId: string, input?: Record<string, unknown>) => {
      let result: Awaited<ReturnType<typeof invokeCommand>>;
      try {
        result = await invokeCommand(commandId, input, {
          surface: 'api',
          actor: 'artifact-tabstrip',
        });
      } catch (error) {
        toast.error('Failed to create artifact', {
          description:
            error instanceof Error
              ? error.message
              : 'An unknown error occurred',
        });
        return;
      }
      const artifactId =
        result.success &&
        result.data &&
        typeof result.data === 'object' &&
        'artifactId' in result.data &&
        typeof result.data.artifactId === 'string'
          ? result.data.artifactId
          : undefined;
      if (artifactId) {
        artifactTabs.selectArtifact(artifactId);
      }
    },
    [artifactTabs, invokeCommand],
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-full shrink-0"
          aria-label="Add new artifact"
        >
          <PlusIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem
          onClick={() =>
            void invokeCreateArtifactCommand('dashboard.create-artifact', {
              layoutType: 'grid',
            })
          }
        >
          <BarChart3Icon /> Dashboard
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            void invokeCreateArtifactCommand('dashboard.create-artifact', {
              layoutType: 'dock',
            })
          }
        >
          <BarChart3Icon /> Dashboard (dock)
        </DropdownMenuItem>
        {CLI_ARTIFACT_TYPES.filter(
          (artifactType) => artifactType !== 'dashboard',
        ).map((artifactType) => {
          const type = ARTIFACT_TYPES[artifactType];
          const Icon = type.icon;
          return (
            <DropdownMenuItem
              key={artifactType}
              onClick={() =>
                void invokeCreateArtifactCommand(
                  `${artifactType}.create-artifact`,
                )
              }
            >
              {Icon ? <Icon /> : null} {`New ${type.label}`}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
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
