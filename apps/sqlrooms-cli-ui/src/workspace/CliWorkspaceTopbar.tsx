import {Button, EditableText} from '@sqlrooms/ui';
import {Plus} from 'lucide-react';
import {useCallback} from 'react';
import {CliArtifactSelector} from '../components/selectors/CliArtifactSelector';
import {useSessionArtifacts} from '../hooks/useSessionArtifacts';
import {useRoomStore} from '../roomStoreHooks';
import {CliSidebarToggleButton} from './sidebar';
import {CliMcpStatusControl} from '../components/CliMcpStatusControl';

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
  const currentSessionId = useRoomStore(
    (state) => state.ai.config.currentSessionId,
  );
  const sessionArtifacts = useSessionArtifacts(currentSessionId);
  const setShowArtifactChooser = useRoomStore(
    (state) => state.workspaceUi.setShowArtifactChooser,
  );

  const handleTitleChange = useCallback(
    (nextTitle: string) => {
      const trimmedTitle = nextTitle.trim();
      if (trimmedTitle) {
        setRoomTitle(trimmedTitle);
      }
    },
    [setRoomTitle],
  );

  return (
    <header className="border-border bg-background/95 grid h-12 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b px-3">
      <div className="flex min-w-0 items-center gap-1.5">
        <CliSidebarToggleButton />
        <EditableText
          value={roomTitle}
          onChange={handleTitleChange}
          placeholder="Untitled Workspace"
          selectOnFocus
          className="text-foreground hover:bg-accent h-9 max-w-48 min-w-0 border-transparent text-sm font-semibold shadow-none ring-0 focus-visible:ring-1"
        />
      </div>
      <div className="flex max-w-[min(34rem,46vw)] min-w-0 items-center justify-center text-center">
        {currentArtifact ? (
          <CliArtifactSelector
            currentArtifact={currentArtifact}
            sessionArtifacts={sessionArtifacts}
          />
        ) : (
          <span className="text-muted-foreground truncate text-sm">
            No artifact selected
          </span>
        )}
      </div>
      <div className="flex min-w-0 items-center justify-end gap-1.5">
        <CliMcpStatusControl />
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
    </header>
  );
}
