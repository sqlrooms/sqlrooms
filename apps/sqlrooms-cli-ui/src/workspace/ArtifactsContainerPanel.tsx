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
  toast,
} from '@sqlrooms/ui';
import {
  BarChart3Icon,
  PencilIcon,
  PlusIcon,
  SparklesIcon,
  TrashIcon,
  XIcon,
} from 'lucide-react';
import {useCallback, useEffect, useRef, useState} from 'react';
import {CLI_ARTIFACT_TYPES} from '../artifactTypeIds';
import {ARTIFACT_TYPES} from '../artifactTypes';
import {useRoomStore} from '../store';

export const ArtifactsContainerPanel: RoomPanelComponent = () => {
  const [deleteConfirm, setDeleteConfirm] = useState<{
    tabId: string;
    tabName: string;
  } | null>(null);
  const showArtifactChooser = useRoomStore(
    (state) => state.workspaceUi.showArtifactChooser,
  );
  const setShowArtifactChooser = useRoomStore(
    (state) => state.workspaceUi.setShowArtifactChooser,
  );
  const isAssistantCollapsed = useRoomStore((state) =>
    state.layout.isCollapsed('assistant-sidebar'),
  );
  const setCollapsed = useRoomStore((state) => state.layout.setCollapsed);
  const previousAssistantCollapsedRef = useRef<boolean | null>(null);

  const handleDeleteTab = useCallback((tabId: string, tabName: string) => {
    setDeleteConfirm({tabId, tabName});
  }, []);

  useEffect(() => {
    if (showArtifactChooser) {
      previousAssistantCollapsedRef.current ??= isAssistantCollapsed;
      if (!isAssistantCollapsed) {
        setCollapsed('assistant-sidebar', true);
      }
      return;
    }

    const previousAssistantCollapsed = previousAssistantCollapsedRef.current;
    if (previousAssistantCollapsed !== null) {
      setCollapsed('assistant-sidebar', previousAssistantCollapsed);
      previousAssistantCollapsedRef.current = null;
    }
  }, [isAssistantCollapsed, setCollapsed, showArtifactChooser]);

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
      className="hidden"
      onActivateArtifact={() => setShowArtifactChooser(false)}
      onSelectArtifact={() => setShowArtifactChooser(false)}
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
      content={
        showArtifactChooser ? (
          <CliArtifactsStartScreen
            onDone={() => setShowArtifactChooser(false)}
          />
        ) : undefined
      }
      emptyContent={
        <CliArtifactsStartScreen onDone={() => setShowArtifactChooser(false)} />
      }
    >
      <ArtifactTabs.SearchDropdown />
      <ArtifactTabs.Tabs />
      <Button
        size="icon"
        variant="ghost"
        className="h-full shrink-0"
        aria-label="Add new artifact"
        onClick={() => setShowArtifactChooser(true)}
      >
        <PlusIcon className="h-4 w-4" />
      </Button>
      <div className="flex-1" />
      <AssistantToggleButton />
    </ArtifactTabs>
  );
};

type CreateCliArtifactCommand = (
  commandId: string,
  input?: Record<string, unknown>,
) => Promise<string | undefined>;

function useCreateCliArtifactCommand(): CreateCliArtifactCommand {
  const artifactTabs = ArtifactTabs.useActions();
  const invokeCommand = useRoomStore((state) => state.commands.invokeCommand);

  return useCallback(
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
        return undefined;
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
      return artifactId;
    },
    [artifactTabs, invokeCommand],
  );
}

function CliArtifactsStartScreen({onDone}: {onDone?: () => void}) {
  const artifactTabs = ArtifactTabs.useActions();
  const invokeCreateArtifactCommand = useCreateCliArtifactCommand();
  const WorksheetIcon = ARTIFACT_TYPES.worksheet.icon;
  const returnArtifactId = artifactTabs.selectedTabId ?? artifactTabs.openTabs[0];
  const secondaryArtifactTypes = CLI_ARTIFACT_TYPES.filter(
    (artifactType) => artifactType !== 'worksheet',
  );

  const handleClose = useCallback(() => {
    if (!returnArtifactId) return;
    artifactTabs.selectArtifact(returnArtifactId);
    onDone?.();
  }, [artifactTabs, onDone, returnArtifactId]);

  return (
    <div className="bg-background relative flex min-h-0 flex-1 items-center justify-center overflow-auto">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-foreground absolute top-4 right-4 size-9"
        disabled={!returnArtifactId}
        aria-label="Close new artifact panel"
        onClick={handleClose}
      >
        <XIcon className="h-4 w-4" aria-hidden />
      </Button>
      <div className="flex w-full max-w-3xl flex-col items-center gap-8 px-8 py-12 text-center">
        <Button
          size="lg"
          className="h-12 px-6 text-base"
          onClick={() => {
            void invokeCreateArtifactCommand(
              'worksheet.create-artifact',
            ).then((artifactId) => {
              if (artifactId) onDone?.();
            });
          }}
        >
          {WorksheetIcon ? <WorksheetIcon className="h-5 w-5" /> : null}
          New Worksheet
        </Button>

        <section className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {secondaryArtifactTypes.map((artifactType) => {
            const type = ARTIFACT_TYPES[artifactType];
            const Icon = type.icon;
            if (artifactType === 'dashboard') {
              return (
                <Button
                  key={artifactType}
                  variant="outline"
                  size="lg"
                  className="h-12 justify-start gap-3 px-5 text-base"
                  onClick={() => {
                    void invokeCreateArtifactCommand(
                      'dashboard.create-artifact',
                      {layoutType: 'grid'},
                    ).then((artifactId) => {
                      if (artifactId) onDone?.();
                    });
                  }}
                >
                  <BarChart3Icon className="h-5 w-5" />
                  Dashboard
                </Button>
              );
            }
            return (
              <Button
                key={artifactType}
                variant="outline"
                size="lg"
                className="h-12 justify-start gap-3 px-5 text-base"
                onClick={() => {
                  void invokeCreateArtifactCommand(
                    `${artifactType}.create-artifact`,
                  ).then((artifactId) => {
                    if (artifactId) onDone?.();
                  });
                }}
              >
                {Icon ? <Icon className="h-5 w-5" /> : null}
                {type.label}
              </Button>
            );
          })}
        </section>
      </div>
    </div>
  );
}

function AssistantToggleButton() {
  const showArtifactChooser = useRoomStore(
    (s) => s.workspaceUi.showArtifactChooser,
  );
  const toggleCollapsed = useRoomStore((s) => s.layout.toggleCollapsed);
  const isAssistantCollapsed = useRoomStore((s) =>
    s.layout.isCollapsed('assistant-sidebar'),
  );

  if (showArtifactChooser || !isAssistantCollapsed) {
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
