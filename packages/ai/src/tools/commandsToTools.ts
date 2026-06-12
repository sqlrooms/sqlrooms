import type {StoreApi} from 'zustand';
import type {RoomCommand, BaseRoomStoreState} from '@sqlrooms/room-shell';
import type {ToolSet} from 'ai';
import {commandToTool, type CommandToToolOptions} from './commandToTool';

/**
 * Converts multiple commands to tools as a Record<toolName, Tool>.
 *
 * By default, uses sanitized command.id as the tool name (dots replaced with underscores).
 *
 * @param commands Commands to convert
 * @param store Store for execution context
 * @param options Optional configuration
 */
export function commandsToTools<TState extends BaseRoomStoreState>(
  commands: RoomCommand<TState>[],
  store: StoreApi<TState>,
  options?: CommandsToToolsOptions<TState>,
): ToolSet {
  const tools: ToolSet = {};

  for (const command of commands) {
    const toolName =
      options?.nameMapper?.(command) ?? sanitizeToolName(command.id);
    const toolOptions =
      options?.optionsPerCommand?.(command) ?? options?.defaultOptions;

    tools[toolName] = commandToTool(command, store, toolOptions);
  }

  return tools;
}

/**
 * Options for batch command-to-tool conversion
 */
export type CommandsToToolsOptions<
  TState extends BaseRoomStoreState = BaseRoomStoreState,
> = {
  /**
   * Function to map command to tool name
   * @default (command) => sanitizeToolName(command.id)
   */
  nameMapper?: (command: RoomCommand<TState>) => string;

  /**
   * Default options applied to all commands
   */
  defaultOptions?: CommandToToolOptions;

  /**
   * Function to customize options per command
   */
  optionsPerCommand?: (
    command: RoomCommand<TState>,
  ) => CommandToToolOptions | undefined;
};

/**
 * Sanitizes command ID to valid tool name format.
 * Replaces dots and other special characters with underscores.
 */
function sanitizeToolName(commandId: string): string {
  return commandId.replace(/[^a-zA-Z0-9_-]/g, '_');
}
