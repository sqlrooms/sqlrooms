import {Button, Tooltip, TooltipContent, TooltipTrigger} from '@sqlrooms/ui';
import {SparklesIcon} from 'lucide-react';
import {CLI_ARTIFACT_TYPES, type CliArtifactType} from '../../artifactTypeIds';
import {useRoomStore} from '../../roomStoreHooks';

export function CliAssistantToggleButton() {
  const showArtifactChooser = useRoomStore(
    (state) => state.workspaceUi.showArtifactChooser,
  );
  const currentArtifactId = useRoomStore(
    (state) => state.artifacts.config.currentArtifactId,
  );
  const artifactsById = useRoomStore(
    (state) => state.artifacts.config.artifactsById,
  );
  const toggleCollapsed = useRoomStore((state) => state.layout.toggleCollapsed);
  const isAssistantCollapsed = useRoomStore((state) =>
    state.layout.isCollapsed('assistant-sidebar'),
  );
  const currentArtifact = currentArtifactId && artifactsById[currentArtifactId];
  const hasCurrentCliArtifact =
    currentArtifact &&
    CLI_ARTIFACT_TYPES.includes(currentArtifact.type as CliArtifactType);

  if (showArtifactChooser || !hasCurrentCliArtifact) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground data-[active=true]:bg-accent data-[active=true]:text-foreground size-9"
          onClick={() => toggleCollapsed('assistant-sidebar')}
          data-active={!isAssistantCollapsed}
        >
          <SparklesIcon className="h-4 w-4" />
          <span className="sr-only">AI Assistant</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>AI Assistant</TooltipContent>
    </Tooltip>
  );
}
