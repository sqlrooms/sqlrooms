import {
  useArtifactWorkspace,
  type ArtifactMetadataType,
  type UseArtifactWorkspaceResult,
} from '@sqlrooms/artifacts';
import {RoomPanelComponent, type RoomPanelInfo} from '@sqlrooms/layout';
import {Button, toast} from '@sqlrooms/ui';
import {BarChart3Icon, XIcon} from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import {CLI_ARTIFACT_TYPES} from '../artifactTypeIds';
import {useRoomStore} from '../store';

type CliArtifactWorkspaceActions = UseArtifactWorkspaceResult;

const CliArtifactWorkspaceActionsContext =
  createContext<CliArtifactWorkspaceActions | null>(null);

function useCliArtifactWorkspaceActions() {
  const context = useContext(CliArtifactWorkspaceActionsContext);
  if (!context) {
    throw new Error(
      'useCliArtifactWorkspaceActions must be used within ArtifactsContainerPanel',
    );
  }
  return context;
}

export const ArtifactsContainerPanel: RoomPanelComponent = () => {
  const artifactActions = useArtifactWorkspace({types: CLI_ARTIFACT_TYPES});
  const showArtifactChooser = useRoomStore(
    (state) => state.workspaceUi.showArtifactChooser,
  );
  const setShowArtifactChooser = useRoomStore(
    (state) => state.workspaceUi.setShowArtifactChooser,
  );
  const isArtifactStartScreenVisible =
    showArtifactChooser || !artifactActions.selectedArtifact;
  const isAssistantCollapsed = useRoomStore((state) =>
    state.layout.isCollapsed('assistant-sidebar'),
  );
  const setCollapsed = useRoomStore((state) => state.layout.setCollapsed);
  const previousAssistantCollapsedRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (isArtifactStartScreenVisible) {
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
  }, [isArtifactStartScreenVisible, isAssistantCollapsed, setCollapsed]);

  return (
    <CliArtifactWorkspaceActionsContext.Provider value={artifactActions}>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <CliArtifactContentHost
          content={
            showArtifactChooser ? (
              <CliArtifactsStartScreen
                onDone={() => setShowArtifactChooser(false)}
              />
            ) : undefined
          }
          emptyContent={
            <CliArtifactsStartScreen
              onDone={() => setShowArtifactChooser(false)}
            />
          }
        />
      </div>
    </CliArtifactWorkspaceActionsContext.Provider>
  );
};

function CliArtifactContentHost({
  content,
  emptyContent,
}: {
  content?: ReactNode;
  emptyContent: ReactNode;
}) {
  const artifactActions = useCliArtifactWorkspaceActions();
  const ensureArtifact = useRoomStore(
    (state) => state.artifacts.ensureArtifact,
  );
  const selectedArtifact = artifactActions.selectedArtifact;

  useEffect(() => {
    if (!selectedArtifact) return;
    ensureArtifact(selectedArtifact.id, {
      type: selectedArtifact.type,
      title: selectedArtifact.title,
    });
  }, [ensureArtifact, selectedArtifact]);

  if (content) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {content}
      </div>
    );
  }

  if (!selectedArtifact) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {emptyContent}
      </div>
    );
  }

  return <SelectedCliArtifactContent artifact={selectedArtifact} />;
}

function SelectedCliArtifactContent({
  artifact,
}: {
  artifact: ArtifactMetadataType;
}) {
  const artifactTypes = useRoomStore((state) => state.artifacts.artifactTypes);
  const typeDefinition = artifactTypes[artifact.type];
  const Component = typeDefinition?.component;

  const panelInfo = useMemo<RoomPanelInfo>(
    () => ({
      title:
        artifact.title ||
        typeDefinition?.defaultTitle ||
        typeDefinition?.label ||
        'Artifact',
      icon: typeDefinition?.icon,
      component: Component,
    }),
    [
      Component,
      artifact.title,
      typeDefinition?.defaultTitle,
      typeDefinition?.icon,
      typeDefinition?.label,
    ],
  );

  if (!Component) {
    return null;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Component
        key={artifact.id}
        panelInfo={panelInfo}
        panelId="artifact"
        meta={{artifactId: artifact.id}}
      />
    </div>
  );
}

type CreateCliArtifactCommand = (
  commandId: string,
  input?: Record<string, unknown>,
) => Promise<string | undefined>;

function useCreateCliArtifactCommand(): CreateCliArtifactCommand {
  const artifactActions = useCliArtifactWorkspaceActions();
  const invokeCommand = useRoomStore((state) => state.commands.invokeCommand);

  return useCallback(
    async (commandId: string, input?: Record<string, unknown>) => {
      let result: Awaited<ReturnType<typeof invokeCommand>>;
      try {
        result = await invokeCommand(commandId, input, {
          surface: 'api',
          actor: 'artifact-content-host',
        });
      } catch (error) {
        toast.error('Failed to create item', {
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
        artifactActions.selectArtifact(artifactId);
      }
      return artifactId;
    },
    [artifactActions, invokeCommand],
  );
}

function CliArtifactsStartScreen({onDone}: {onDone?: () => void}) {
  const artifactActions = useCliArtifactWorkspaceActions();
  const invokeCreateArtifactCommand = useCreateCliArtifactCommand();
  const WorksheetIcon = artifactActions.artifactTypes.worksheet?.icon;
  const returnArtifactId =
    artifactActions.selectedArtifactId ?? artifactActions.artifactIds[0];
  const secondaryArtifactTypes = CLI_ARTIFACT_TYPES.filter(
    (artifactType) =>
      artifactType !== 'worksheet' &&
      Boolean(artifactActions.artifactTypes[artifactType]),
  );

  const handleClose = useCallback(() => {
    if (!returnArtifactId) return;
    artifactActions.selectArtifact(returnArtifactId);
    onDone?.();
  }, [artifactActions, onDone, returnArtifactId]);

  return (
    <div className="bg-background relative flex min-h-0 flex-1 items-center justify-center overflow-auto">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-foreground absolute top-4 right-4 size-9"
        disabled={!returnArtifactId}
        aria-label="Close new item panel"
        onClick={handleClose}
      >
        <XIcon className="h-4 w-4" aria-hidden />
      </Button>
      <div className="flex w-full max-w-3xl flex-col items-center gap-8 px-8 py-12 text-center">
        <Button
          size="lg"
          className="h-12 px-6 text-base"
          onClick={() => {
            void invokeCreateArtifactCommand('worksheet.create-artifact').then(
              (artifactId) => {
                if (artifactId) onDone?.();
              },
            );
          }}
        >
          {WorksheetIcon ? <WorksheetIcon className="h-5 w-5" /> : null}
          New Worksheet
        </Button>

        <section className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {secondaryArtifactTypes.map((artifactType) => {
            const type = artifactActions.artifactTypes[artifactType];
            if (!type) return null;
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
