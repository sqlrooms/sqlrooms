import {AiDebugInspector} from '@sqlrooms/ai/debug';
import {RoomShell} from '@sqlrooms/room-shell';
import {
  Button,
  ThemeSwitch,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@sqlrooms/ui';
import {TerminalIcon} from 'lucide-react';
import {useCallback} from 'react';
import {useRoomStore} from '../../store';
import {DbConnectionsSection} from './DbConnectionsSection';

export function CliSidebarFooterControls({
  onToggleSqlEditor,
}: {
  onToggleSqlEditor: () => void;
}) {
  const currentArtifactId = useRoomStore(
    (state) => state.artifacts.config.currentArtifactId,
  );
  const aiSessionArtifacts = useRoomStore(
    (state) => state.artifactAi.config.aiSessionArtifacts,
  );
  const getExtraSummary = useCallback(
    ({selectedSessionId}: {selectedSessionId: string | null}) => ({
      currentArtifactId,
      selectedArtifactId: selectedSessionId
        ? aiSessionArtifacts[selectedSessionId]
        : undefined,
    }),
    [aiSessionArtifacts, currentArtifactId],
  );

  return (
    <div className="flex items-center gap-1 group-data-[collapsible=icon]:flex-col">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:bg-sidebar-accent hover:text-primary size-8"
            onClick={onToggleSqlEditor}
          >
            <TerminalIcon className="h-4 w-4" />
            <span className="sr-only">SQL Editor</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">SQL Editor</TooltipContent>
      </Tooltip>
      <RoomShell.CommandPalette.Button className="text-muted-foreground hover:bg-sidebar-accent hover:text-primary size-8 rounded-md" />
      <DbConnectionsSection />
      {import.meta.env.DEV && (
        <AiDebugInspector
          triggerClassName="text-muted-foreground hover:bg-sidebar-accent hover:text-primary size-8 rounded-md"
          extraSummary={getExtraSummary}
        />
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="hover:bg-sidebar-accent flex size-8 items-center justify-center rounded-md">
            <ThemeSwitch className="data-[state=checked]:bg-primary/30 data-[state=unchecked]:bg-sidebar-accent" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">Toggle theme</TooltipContent>
      </Tooltip>
    </div>
  );
}
