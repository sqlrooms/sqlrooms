import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@sqlrooms/ui';
import {FileStackIcon, LoaderCircleIcon, Plus} from 'lucide-react';
import {useRoomStore} from '../../store';
import {useCliArtifactSidebarTabs} from './useCliArtifactSidebarTabs';

export function CliArtifactsSidebarSection() {
  const artifactTabs = useCliArtifactSidebarTabs();
  const openArtifactChooser = useRoomStore(
    (state) => state.workspaceUi.setShowArtifactChooser,
  );
  const {state} = useSidebar();

  if (state === 'expanded') {
    return (
      <>
        <div className="mb-1 flex h-7 items-center justify-between px-2">
          <div className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            Artifacts
          </div>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="text-primary hover:bg-primary/10 hover:text-primary h-6 gap-1 px-2 text-sm"
            onClick={() => openArtifactChooser(true)}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            New
          </Button>
        </div>
        <SidebarMenu className="gap-0.5">
          {artifactTabs.tabs.map((artifact) => {
            const type = artifactTabs.artifactTypes[artifact.type];
            const Icon = type?.icon ?? FileStackIcon;
            return (
              <SidebarMenuItem key={artifact.id}>
                <SidebarMenuButton
                  className="data-[active=true]:bg-primary/15 data-[active=true]:text-primary hover:bg-sidebar-accent h-7 gap-2 px-2 text-sm font-normal [&>svg]:size-3.5"
                  isActive={artifact.id === artifactTabs.selectedTabId}
                  onClick={() => artifactTabs.selectArtifact(artifact.id)}
                  type="button"
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">
                    {artifact.name}
                  </span>
                  {artifact.runningSessionCount > 0 ? (
                    <LoaderCircleIcon className="text-primary h-3.5 w-3.5 shrink-0 animate-spin" />
                  ) : null}
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          className="hover:bg-sidebar-accent data-[state=open]:bg-sidebar-accent"
          type="button"
          size="lg"
          aria-label="Artifacts"
        >
          <FileStackIcon className="h-4 w-4" aria-hidden />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="bg-popover border-border [&_[role=menuitem]]:focus:bg-accent w-72"
        align="start"
        side="right"
        sideOffset={8}
      >
        <DropdownMenuLabel>Artifacts</DropdownMenuLabel>
        {artifactTabs.tabs.map((artifact) => {
          const type = artifactTabs.artifactTypes[artifact.type];
          const Icon = type?.icon ?? FileStackIcon;
          return (
            <DropdownMenuItem
              key={artifact.id}
              onClick={() => artifactTabs.selectArtifact(artifact.id)}
            >
              <Icon className="h-4 w-4" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{artifact.name}</span>
              {artifact.runningSessionCount > 0 ? (
                <LoaderCircleIcon className="text-primary ml-auto h-3.5 w-3.5 shrink-0 animate-spin" />
              ) : null}
            </DropdownMenuItem>
          );
        })}
        {artifactTabs.tabs.length === 0 ? (
          <DropdownMenuItem disabled>No artifacts</DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => openArtifactChooser(true)}>
          <Plus className="h-4 w-4" aria-hidden />
          New Artifact
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
