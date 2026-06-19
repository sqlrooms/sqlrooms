import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  ScrollArea,
  ScrollBar,
  useSidebar,
} from '@sqlrooms/ui';
import {FileStackIcon, LoaderCircleIcon, Plus} from 'lucide-react';
import {useState} from 'react';
import {useRoomStore} from '../../store';
import {useCliArtifactSidebarTabs} from './useCliArtifactSidebarTabs';

export function CliArtifactsSidebarSection() {
  const artifactTabs = useCliArtifactSidebarTabs();
  const openArtifactChooser = useRoomStore(
    (state) => state.workspaceUi.setShowArtifactChooser,
  );
  const {state} = useSidebar();
  const [popoverOpen, setPopoverOpen] = useState(false);

  if (state === 'expanded') {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-col">
        <div className="mb-1 flex h-7 shrink-0 items-center justify-between px-2">
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
        <ScrollArea className="min-h-0 min-w-0 flex-1 overflow-hidden [&_[data-radix-scroll-area-viewport]>div]:!block [&_[data-radix-scroll-area-viewport]>div]:!w-full [&_[data-radix-scroll-area-viewport]>div]:!min-w-0">
          <div className="w-full max-w-full min-w-0 overflow-hidden pr-2">
            <SidebarMenu className="max-w-full min-w-0 gap-0.5 overflow-hidden">
              {artifactTabs.tabs.length === 0 ? (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    className="data-[active=true]:bg-primary/15 data-[active=true]:text-primary hover:bg-sidebar-accent h-7 max-w-full min-w-0 gap-2 px-2 text-sm font-normal [&>svg]:size-3.5"
                    disabled
                    type="button"
                  >
                    <span className="block min-w-0 flex-1 truncate">
                      No artifacts
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}
              {artifactTabs.tabs.map((artifact) => {
                const type = artifactTabs.artifactTypes[artifact.type];
                const Icon = type?.icon ?? FileStackIcon;
                return (
                  <SidebarMenuItem key={artifact.id} className="min-w-0">
                    <SidebarMenuButton
                      className="data-[active=true]:bg-primary/15 data-[active=true]:text-primary hover:bg-sidebar-accent h-7 max-w-full min-w-0 gap-2 px-2 text-sm font-normal [&>svg]:size-3.5"
                      isActive={artifact.id === artifactTabs.selectedTabId}
                      onClick={() => artifactTabs.selectArtifact(artifact.id)}
                      type="button"
                      title={artifact.name}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden />
                      <span className="block min-w-0 flex-1 truncate">
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
          </div>
          <ScrollBar orientation="vertical" />
        </ScrollArea>
      </div>
    );
  }

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <SidebarMenuButton
          className="hover:bg-sidebar-accent data-[state=open]:bg-sidebar-accent"
          type="button"
          size="lg"
          aria-label="Artifacts"
        >
          <FileStackIcon className="h-4 w-4" aria-hidden />
        </SidebarMenuButton>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0"
        align="start"
        side="right"
        sideOffset={8}
      >
        <Command>
          <CommandInput placeholder="Search artifacts..." />
          <CommandList className="max-h-none overflow-hidden">
            <CommandEmpty>No artifacts found.</CommandEmpty>
            <ScrollArea className="h-[min(70vh,360px)] overflow-hidden [&_[data-radix-scroll-area-viewport]>div]:!block">
              <CommandGroup heading="Artifacts">
                {artifactTabs.tabs.map((artifact) => {
                  const type = artifactTabs.artifactTypes[artifact.type];
                  const Icon = type?.icon ?? FileStackIcon;
                  return (
                    <CommandItem
                      key={artifact.id}
                      value={`${artifact.name} ${artifact.id}`}
                      onSelect={() => {
                        artifactTabs.selectArtifact(artifact.id);
                        setPopoverOpen(false);
                      }}
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">
                        {artifact.name}
                      </span>
                      {artifact.runningSessionCount > 0 ? (
                        <LoaderCircleIcon className="text-primary ml-auto h-3.5 w-3.5 shrink-0 animate-spin" />
                      ) : null}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </ScrollArea>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                value="new artifact"
                onSelect={() => {
                  openArtifactChooser(true);
                  setPopoverOpen(false);
                }}
              >
                <Plus className="h-4 w-4" aria-hidden />
                New Artifact
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
