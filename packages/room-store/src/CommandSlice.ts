import {produce} from 'immer';
import {StoreApi} from 'zustand';
import {BaseRoomStoreState, createSlice, StateCreator} from './BaseRoomStore';

const DEFAULT_COMMAND_OWNER = 'global';

export type RoomCommandExecutionContext<
  RS extends BaseRoomStoreState = BaseRoomStoreState,
> = {
  store: StoreApi<RS>;
  getState: () => RS;
};

export type RoomCommandPredicate<
  RS extends BaseRoomStoreState = BaseRoomStoreState,
> = (context: RoomCommandExecutionContext<RS>) => boolean;

export type RoomCommand<RS extends BaseRoomStoreState = BaseRoomStoreState> = {
  /**
   * Unique command identifier.
   */
  id: string;
  /**
   * Human-readable command name shown in the palette.
   */
  name: string;
  /**
   * Optional additional context shown in the UI.
   */
  description?: string;
  /**
   * Optional group/category label.
   */
  group?: string;
  /**
   * Optional extra words used by search.
   */
  keywords?: string[];
  /**
   * Optional shortcut label (display only).
   */
  shortcut?: string;
  /**
   * Command implementation.
   */
  execute: (
    context: RoomCommandExecutionContext<RS>,
  ) => void | Promise<void>;
  /**
   * Whether this command should be shown in command UIs.
   */
  isVisible?: RoomCommandPredicate<RS>;
  /**
   * Whether this command can currently execute.
   */
  isEnabled?: RoomCommandPredicate<RS>;
};

export type RegisteredRoomCommand<
  RS extends BaseRoomStoreState = BaseRoomStoreState,
> = RoomCommand<RS> & {
  owner: string;
};

export type CommandSliceState<
  RS extends BaseRoomStoreState = BaseRoomStoreState,
> = {
  commands: {
    registry: Record<string, RegisteredRoomCommand<RS>>;
    ownerToCommandIds: Record<string, string[]>;
    registerCommand: (owner: string, command: RoomCommand<RS>) => void;
    registerCommands: (owner: string, commands: RoomCommand<RS>[]) => void;
    unregisterCommand: (commandId: string) => void;
    unregisterCommands: (owner: string) => void;
    executeCommand: (commandId: string) => Promise<void>;
  };
};

export function createCommandSlice<
  RS extends BaseRoomStoreState = BaseRoomStoreState,
>(): StateCreator<CommandSliceState<RS>> {
  return createSlice<CommandSliceState<RS>, RS & CommandSliceState<RS>>(
    (set, get, store) => ({
      commands: {
        registry: {},
        ownerToCommandIds: {},
        registerCommand: (owner, command) =>
          get().commands.registerCommands(owner, [command]),
        registerCommands: (owner, commands) => {
          const normalizedOwner = normalizeOwner(owner);
          set((state) =>
            produce(state, (draft) => {
              const previousIds =
                draft.commands.ownerToCommandIds[normalizedOwner] ?? [];
              for (const previousId of previousIds) {
                delete draft.commands.registry[previousId];
              }

              const nextIds = new Set<string>();
              for (const command of commands) {
                if (!command.id) {
                  continue;
                }

                const existingCommand = draft.commands.registry[command.id];
                if (existingCommand && existingCommand.owner !== normalizedOwner) {
                  removeCommandIdFromOwner(
                    draft.commands.ownerToCommandIds,
                    existingCommand.owner,
                    command.id,
                  );
                }

                draft.commands.registry[command.id] = {
                  ...command,
                  owner: normalizedOwner,
                };
                nextIds.add(command.id);
              }

              if (nextIds.size === 0) {
                delete draft.commands.ownerToCommandIds[normalizedOwner];
                return;
              }

              draft.commands.ownerToCommandIds[normalizedOwner] =
                Array.from(nextIds);
            }),
          );
        },
        unregisterCommand: (commandId) => {
          const existingCommand = get().commands.registry[commandId];
          if (!existingCommand) {
            return;
          }
          set((state) =>
            produce(state, (draft) => {
              delete draft.commands.registry[commandId];
              removeCommandIdFromOwner(
                draft.commands.ownerToCommandIds,
                existingCommand.owner,
                commandId,
              );
            }),
          );
        },
        unregisterCommands: (owner) => {
          const normalizedOwner = normalizeOwner(owner);
          set((state) =>
            produce(state, (draft) => {
              const commandIds =
                draft.commands.ownerToCommandIds[normalizedOwner] ?? [];
              for (const commandId of commandIds) {
                delete draft.commands.registry[commandId];
              }
              delete draft.commands.ownerToCommandIds[normalizedOwner];
            }),
          );
        },
        executeCommand: async (commandId) => {
          const command = get().commands.registry[commandId];
          if (!command) {
            return;
          }
          const executionContext = createRoomCommandExecutionContext(
            store as StoreApi<RS>,
          );
          try {
            await command.execute(executionContext);
          } catch (error) {
            get().room.captureException(error);
            throw error;
          }
        },
      },
    }),
  );
}

export function createRoomCommandExecutionContext<
  RS extends BaseRoomStoreState,
>(store: StoreApi<RS>): RoomCommandExecutionContext<RS> {
  return {
    store,
    getState: () => store.getState(),
  };
}

export function hasCommandSliceState(
  state: unknown,
): state is BaseRoomStoreState & CommandSliceState {
  if (typeof state !== 'object' || state === null || !('commands' in state)) {
    return false;
  }

  const commands = state.commands;
  if (typeof commands !== 'object' || commands === null) {
    return false;
  }

  return (
    'registerCommands' in commands &&
    typeof commands.registerCommands === 'function' &&
    'unregisterCommands' in commands &&
    typeof commands.unregisterCommands === 'function' &&
    'executeCommand' in commands &&
    typeof commands.executeCommand === 'function'
  );
}

export function registerCommandsForOwner<RS extends BaseRoomStoreState>(
  store: StoreApi<RS>,
  owner: string,
  commands: RoomCommand<RS>[],
): void {
  const state = store.getState();
  if (!hasCommandSliceState(state)) {
    return;
  }
  state.commands.registerCommands(
    owner,
    commands as unknown as RoomCommand<BaseRoomStoreState>[],
  );
}

export function unregisterCommandsForOwner<RS extends BaseRoomStoreState>(
  store: StoreApi<RS>,
  owner: string,
): void {
  const state = store.getState();
  if (!hasCommandSliceState(state)) {
    return;
  }
  state.commands.unregisterCommands(owner);
}

function removeCommandIdFromOwner(
  ownerToCommandIds: Record<string, string[]>,
  owner: string,
  commandId: string,
): void {
  const ownerCommandIds = ownerToCommandIds[owner];
  if (!ownerCommandIds) {
    return;
  }

  const filteredIds = ownerCommandIds.filter((id) => id !== commandId);
  if (filteredIds.length === 0) {
    delete ownerToCommandIds[owner];
    return;
  }
  ownerToCommandIds[owner] = filteredIds;
}

function normalizeOwner(owner: string): string {
  const trimmed = owner.trim();
  if (trimmed.length > 0) {
    return trimmed;
  }
  return DEFAULT_COMMAND_OWNER;
}
