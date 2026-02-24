import {
  createRoomCommandExecutionContext,
  RegisteredRoomCommand,
  RoomCommandExecutionContext,
  useRoomStoreApi,
} from '@sqlrooms/room-store';
import {
  Button,
  cn,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@sqlrooms/ui';
import {isMacOS} from '@sqlrooms/utils';
import {CommandIcon} from 'lucide-react';
import {
  ComponentProps,
  ComponentType,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {RoomShellSliceState, useBaseRoomShellStore} from './RoomShellSlice';

const GENERAL_COMMAND_GROUP = 'General';

export type RoomShellCommandPaletteProps = {
  isOpen?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  placeholder?: string;
  emptyMessage?: string;
  enableKeyboardShortcut?: boolean;
};

type PaletteCommand = RegisteredRoomCommand & {
  enabled: boolean;
};

type CommandPaletteControlAction = 'open' | 'close' | 'toggle';
type CommandPaletteControlListener = (
  action: CommandPaletteControlAction,
) => void;

const commandPaletteControlListeners = new Set<CommandPaletteControlListener>();

function subscribeToCommandPaletteControl(
  listener: CommandPaletteControlListener,
) {
  commandPaletteControlListeners.add(listener);
  return () => {
    commandPaletteControlListeners.delete(listener);
  };
}

function requestCommandPaletteControl(action: CommandPaletteControlAction) {
  for (const listener of commandPaletteControlListeners) {
    listener(action);
  }
}

function RoomShellCommandPaletteBase({
  isOpen: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  placeholder = 'Type a command or search...',
  emptyMessage = 'No commands found.',
  enableKeyboardShortcut = true,
}: RoomShellCommandPaletteProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isOpen = controlledOpen ?? uncontrolledOpen;
  const isOpenRef = useRef(isOpen);
  const roomStore = useRoomStoreApi<RoomShellSliceState>();
  const commandRegistry = useBaseRoomShellStore(
    (state) => state.commands.registry,
  );

  const commandContext = useMemo(
    () => createRoomCommandExecutionContext(roomStore),
    [roomStore],
  );

  const commands = useMemo(() => {
    const nextCommands: PaletteCommand[] = [];
    for (const command of Object.values(commandRegistry)) {
      if (!resolveCommandVisibility(command, commandContext)) {
        continue;
      }
      nextCommands.push({
        ...command,
        enabled: resolveCommandEnabled(command, commandContext),
      });
    }

    nextCommands.sort((first, second) => first.name.localeCompare(second.name));
    return nextCommands;
  }, [commandContext, commandRegistry]);

  const groupedCommands = useMemo(() => {
    const groups = new Map<string, PaletteCommand[]>();
    for (const command of commands) {
      const groupName = command.group ?? GENERAL_COMMAND_GROUP;
      const existingGroup = groups.get(groupName);
      if (existingGroup) {
        existingGroup.push(command);
      } else {
        groups.set(groupName, [command]);
      }
    }

    return Array.from(groups.entries()).sort(([firstGroup], [secondGroup]) => {
      if (firstGroup === GENERAL_COMMAND_GROUP) {
        return -1;
      }
      if (secondGroup === GENERAL_COMMAND_GROUP) {
        return 1;
      }
      return firstGroup.localeCompare(secondGroup);
    });
  }, [commands]);

  const setPaletteOpen = useCallback(
    (nextOpen: boolean) => {
      if (controlledOpen === undefined) {
        setUncontrolledOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [controlledOpen, onOpenChange],
  );

  const onSelectCommand = useCallback(
    async (command: PaletteCommand) => {
      if (!command.enabled) {
        return;
      }
      setPaletteOpen(false);
      try {
        await roomStore.getState().commands.executeCommand(command.id);
      } catch {
        // Errors are already captured by room.captureException.
      }
    },
    [roomStore, setPaletteOpen],
  );

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    if (!enableKeyboardShortcut) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const isCommandPaletteShortcut =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (!isCommandPaletteShortcut) {
        return;
      }
      event.preventDefault();
      setPaletteOpen(!isOpenRef.current);
    };

    // Use capture so this still works when focused widgets (e.g. Monaco)
    // stop propagation during the bubble phase.
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [enableKeyboardShortcut, setPaletteOpen]);

  useEffect(() => {
    return subscribeToCommandPaletteControl((action) => {
      if (action === 'open') {
        setPaletteOpen(true);
        return;
      }
      if (action === 'close') {
        setPaletteOpen(false);
        return;
      }
      setPaletteOpen(!isOpenRef.current);
    });
  }, [setPaletteOpen]);

  return (
    <CommandDialog open={isOpen} onOpenChange={setPaletteOpen}>
      <CommandInput placeholder={placeholder} />
      <CommandList>
        <CommandEmpty>{emptyMessage}</CommandEmpty>
        {groupedCommands.map(([groupName, groupCommands]) => (
          <CommandGroup key={groupName} heading={groupName}>
            {groupCommands.map((command) => (
              <CommandItem
                key={command.id}
                value={getCommandSearchValue(command)}
                disabled={!command.enabled}
                onSelect={() => {
                  void onSelectCommand(command);
                }}
              >
                <div className="flex flex-col">
                  <span>{command.name}</span>
                  {command.description ? (
                    <span className="text-muted-foreground text-xs">
                      {command.description}
                    </span>
                  ) : null}
                </div>
                {command.shortcut ? (
                  <CommandShortcut>{command.shortcut}</CommandShortcut>
                ) : null}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

export type RoomShellCommandPaletteButtonProps = Omit<
  ComponentProps<typeof Button>,
  'children'
> & {
  icon?: ComponentType<{className?: string}>;
  iconClassName?: string;
  tooltip?: string;
};

function RoomShellCommandPaletteButton({
  className,
  icon: Icon = CommandIcon,
  iconClassName,
  tooltip,
  variant = 'ghost',
  size = 'icon',
  onClick,
  ...buttonProps
}: RoomShellCommandPaletteButtonProps) {
  const shortcutText = isMacOS() ? 'Cmd+K' : 'Ctrl+K';
  const tooltipText = tooltip ?? `Open command palette (${shortcutText})`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size={size}
          className={cn(className)}
          onClick={(event) => {
            requestCommandPaletteControl('open');
            onClick?.(event);
          }}
          aria-label="Open command palette"
          {...buttonProps}
        >
          <Icon className={cn('h-5 w-5', iconClassName)} />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">{tooltipText}</TooltipContent>
    </Tooltip>
  );
}

export const RoomShellCommandPalette = Object.assign(
  RoomShellCommandPaletteBase,
  {
    Button: RoomShellCommandPaletteButton,
  },
);

function resolveCommandVisibility(
  command: RegisteredRoomCommand,
  context: RoomCommandExecutionContext,
): boolean {
  if (!command.isVisible) {
    return true;
  }
  try {
    return command.isVisible(context);
  } catch (error) {
    context.getState().room.captureException(error);
    return false;
  }
}

function resolveCommandEnabled(
  command: RegisteredRoomCommand,
  context: RoomCommandExecutionContext,
): boolean {
  if (!command.isEnabled) {
    return true;
  }
  try {
    return command.isEnabled(context);
  } catch (error) {
    context.getState().room.captureException(error);
    return false;
  }
}

function getCommandSearchValue(command: RegisteredRoomCommand): string {
  return [
    command.name,
    command.description,
    command.id,
    ...(command.keywords ?? []),
  ]
    .filter((value): value is string => Boolean(value))
    .join(' ');
}
