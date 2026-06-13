import {Button, Tooltip, TooltipContent, TooltipTrigger} from '@sqlrooms/ui';
import {SparklesIcon} from 'lucide-react';
import {useRoomStore} from '../../store';

export function CliAssistantToggleButton() {
  const showArtifactChooser = useRoomStore(
    (state) => state.workspaceUi.showArtifactChooser,
  );
  const toggleCollapsed = useRoomStore((state) => state.layout.toggleCollapsed);
  const isAssistantCollapsed = useRoomStore((state) =>
    state.layout.isCollapsed('assistant-sidebar'),
  );

  if (showArtifactChooser) {
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
