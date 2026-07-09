import {
  SidebarMenuButton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  useSidebar,
} from '@sqlrooms/ui';
import {SparklesIcon} from 'lucide-react';
import {CLI_ARTIFACT_TYPES, type CliArtifactType} from '../../artifactTypeIds';
import {useRoomStore} from '../../store';

export function CliAssistantToggleButton() {
  const {state} = useSidebar();
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
        <SidebarMenuButton
          type="button"
          size={state === 'expanded' ? 'default' : 'lg'}
          className="text-muted-foreground hover:text-foreground data-[active=true]:border-sidebar-border data-[active=true]:bg-sidebar-accent/50 data-[active=true]:text-primary data-[active=true]:hover:bg-sidebar-accent group-data-[state=expanded]:h-10 group-data-[state=expanded]:justify-center group-data-[state=expanded]:gap-2 group-data-[state=expanded]:border"
          onClick={() => toggleCollapsed('assistant-sidebar')}
          data-active={!isAssistantCollapsed}
          aria-label="Toggle AI Agent"
          aria-pressed={!isAssistantCollapsed}
        >
          <SparklesIcon className="h-4 w-4" />
          <span className="group-data-[collapsible=icon]:hidden">AI Agent</span>
        </SidebarMenuButton>
      </TooltipTrigger>
      <TooltipContent side="right">Toggle AI Agent</TooltipContent>
    </Tooltip>
  );
}
