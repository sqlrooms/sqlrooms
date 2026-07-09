import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
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
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  ScrollArea,
  ScrollBar,
  useSidebar,
} from '@sqlrooms/ui';
import {
  EllipsisVerticalIcon,
  FileStackIcon,
  LoaderCircleIcon,
  PencilIcon,
  Plus,
  Trash2Icon,
} from 'lucide-react';
import {FormEvent, useEffect, useRef, useState} from 'react';
import {useRoomStore} from '../../store';
import {useCliArtifactSidebarTabs} from './useCliArtifactSidebarTabs';

const CLI_SIDEBAR_COMMAND_ITEM_CLASS = 'cli-sidebar-command-item';

export function CliArtifactsSidebarSection() {
  const artifactTabs = useCliArtifactSidebarTabs();
  const openArtifactChooser = useRoomStore(
    (state) => state.workspaceUi.setShowArtifactChooser,
  );
  const {state} = useSidebar();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [renameArtifact, setRenameArtifact] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const handleRenameArtifact = (artifactId: string, name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    artifactTabs.renameArtifact(artifactId, trimmedName);
    setRenameArtifact(null);
  };

  const handleDeleteArtifact = () => {
    if (!deleteConfirm) return;
    artifactTabs.deleteArtifact(deleteConfirm.id);
    setDeleteConfirm(null);
  };

  if (state === 'expanded') {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-col">
        <div className="mb-1 flex h-7 shrink-0 items-center justify-between px-2">
          <div className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            Workspace
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
          <div className="w-full max-w-full min-w-0 overflow-visible py-0.5 pr-2 pl-0.5">
            <SidebarMenu className="max-w-full min-w-0 gap-0.5 overflow-visible">
              {artifactTabs.tabs.map((artifact) => {
                const type = artifactTabs.artifactTypes[artifact.type];
                const Icon = type?.icon ?? FileStackIcon;
                return (
                  <SidebarMenuItem key={artifact.id} className="min-w-0">
                    <SidebarMenuButton
                      className="data-[active=true]:bg-primary/15 data-[active=true]:text-primary hover:bg-sidebar-accent h-7 max-w-full min-w-0 gap-2 overflow-visible px-2 text-sm font-normal [&>svg]:size-3.5"
                      isActive={artifact.id === artifactTabs.selectedTabId}
                      onClick={() => artifactTabs.selectArtifact(artifact.id)}
                      size="sm"
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
                    <ArtifactSidebarItemMenu
                      artifactName={artifact.name}
                      onDelete={() =>
                        setDeleteConfirm({
                          id: artifact.id,
                          name: artifact.name,
                        })
                      }
                      onRename={() =>
                        setRenameArtifact({
                          id: artifact.id,
                          name: artifact.name,
                        })
                      }
                    />
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </div>
          <ScrollBar orientation="vertical" />
        </ScrollArea>
        <RenameArtifactDialog
          artifact={renameArtifact}
          onOpenChange={(open) => {
            if (!open) setRenameArtifact(null);
          }}
          onRename={handleRenameArtifact}
        />
        <DeleteArtifactDialog
          artifact={deleteConfirm}
          onOpenChange={(open) => {
            if (!open) setDeleteConfirm(null);
          }}
          onConfirm={handleDeleteArtifact}
        />
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
          aria-label="Workspace items"
        >
          <FileStackIcon className="h-4 w-4" aria-hidden />
        </SidebarMenuButton>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0"
        align="start"
        side="right"
        sideOffset={10}
      >
        <Command>
          <CommandInput placeholder="Search workspace items..." />
          <CommandList className="max-h-none overflow-hidden">
            <CommandEmpty>No matching items.</CommandEmpty>
            <ScrollArea className="h-[min(70vh,360px)] overflow-hidden [&_[data-radix-scroll-area-viewport]>div]:!block">
              <CommandGroup heading="Workspace items">
                {artifactTabs.tabs.map((artifact) => {
                  const type = artifactTabs.artifactTypes[artifact.type];
                  const Icon = type?.icon ?? FileStackIcon;
                  return (
                    <CommandItem
                      className={CLI_SIDEBAR_COMMAND_ITEM_CLASS}
                      data-active={artifact.id === artifactTabs.selectedTabId}
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
                className={CLI_SIDEBAR_COMMAND_ITEM_CLASS}
                value="new"
                onSelect={() => {
                  openArtifactChooser(true);
                  setPopoverOpen(false);
                }}
              >
                <Plus className="h-4 w-4" aria-hidden />
                Create new
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function ArtifactSidebarItemMenu({
  artifactName,
  onDelete,
  onRename,
}: {
  artifactName: string;
  onDelete: () => void;
  onRename: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuAction
          type="button"
          showOnHover
          className="right-1.5"
          aria-label={`More actions for ${artifactName}`}
          onClick={(event) => event.stopPropagation()}
        >
          <EllipsisVerticalIcon className="h-4 w-4" aria-hidden />
        </SidebarMenuAction>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="right">
        <DropdownMenuItem onSelect={onRename}>
          <PencilIcon className="h-4 w-4" aria-hidden />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={onDelete}
        >
          <Trash2Icon className="h-4 w-4" aria-hidden />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RenameArtifactDialog({
  artifact,
  onOpenChange,
  onRename,
}: {
  artifact: {id: string; name: string} | null;
  onOpenChange: (open: boolean) => void;
  onRename: (artifactId: string, name: string) => void;
}) {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(artifact?.name ?? '');
  }, [artifact]);

  useEffect(() => {
    if (!artifact) return;
    const timeoutId = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 100);
    return () => window.clearTimeout(timeoutId);
  }, [artifact]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!artifact) return;
    onRename(artifact.id, name);
  };

  return (
    <Dialog open={artifact !== null} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Rename item</DialogTitle>
            <DialogDescription>
              Choose a new name for this item.
            </DialogDescription>
          </DialogHeader>
          <Input
            ref={inputRef}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="my-4"
            aria-label="Item name"
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Rename
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteArtifactDialog({
  artifact,
  onOpenChange,
  onConfirm,
}: {
  artifact: {id: string; name: string} | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={artifact !== null} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Delete item</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete &ldquo;
            {artifact?.name ?? 'this item'}&rdquo;? This action cannot be
            undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
