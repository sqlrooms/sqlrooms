import {
  createRoomCommandExecutionContext,
  RegisteredRoomCommand,
  RoomCommandExecutionContext,
  useRoomStoreApi,
} from '@sqlrooms/room-store';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@sqlrooms/ui';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
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

export function RoomShellCommandPalette({
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

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [enableKeyboardShortcut, setPaletteOpen]);

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
