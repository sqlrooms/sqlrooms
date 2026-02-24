import type {OpenAssistantToolSet} from '@openassistant/utils';
import {
  createRoomCommandExecutionContext,
  doesCommandRequireInput,
  hasCommandSliceState,
} from '@sqlrooms/room-shell';
import type {
  BaseRoomStoreState,
  RegisteredRoomCommand,
  RoomCommandExecutionContext,
  StoreApi,
} from '@sqlrooms/room-shell';
import {z} from 'zod';

export const ListCommandsToolParameters = z.object({
  includeInvisible: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'Whether to include commands hidden from user-facing UIs (default: false).',
    ),
});

export type ListCommandsToolParameters = z.infer<
  typeof ListCommandsToolParameters
>;

export type CommandToolDescriptor = {
  id: string;
  name: string;
  description?: string;
  group?: string;
  keywords?: string[];
  enabled: boolean;
  requiresInput: boolean;
  inputDescription?: string;
};

export type ListCommandsToolLlmResult = {
  success: boolean;
  commands?: CommandToolDescriptor[];
  details?: string;
  errorMessage?: string;
};

export const ExecuteCommandToolParameters = z.object({
  commandId: z.string().describe('The command ID to execute.'),
  input: z
    .unknown()
    .optional()
    .describe('Optional command input. Must satisfy the command input schema.'),
});

export type ExecuteCommandToolParameters = z.infer<
  typeof ExecuteCommandToolParameters
>;

export type ExecuteCommandToolLlmResult = {
  success: boolean;
  commandId?: string;
  details?: string;
  errorMessage?: string;
};

export type CommandToolsOptions = {
  listToolName?: string;
  executeToolName?: string;
  includeInvisibleCommandsByDefault?: boolean;
  includeDisabledCommandsInList?: boolean;
};

const DEFAULT_LIST_TOOL_NAME = 'list_commands';
const DEFAULT_EXECUTE_TOOL_NAME = 'execute_command';

export function createCommandTools<RS extends BaseRoomStoreState>(
  store: StoreApi<RS>,
  options?: CommandToolsOptions,
): OpenAssistantToolSet {
  const listToolName = options?.listToolName ?? DEFAULT_LIST_TOOL_NAME;
  const executeToolName = options?.executeToolName ?? DEFAULT_EXECUTE_TOOL_NAME;
  const includeInvisibleDefault =
    options?.includeInvisibleCommandsByDefault ?? false;
  const includeDisabledCommandsInList =
    options?.includeDisabledCommandsInList ?? true;

  return {
    [listToolName]: {
      name: listToolName,
      description: `List available room commands, including whether they are enabled and whether they require input.
Use this before executing commands so you can pick a valid command ID and understand input expectations.`,
      parameters: ListCommandsToolParameters,
      execute: async (params: ListCommandsToolParameters) => {
        const descriptors = getCommandDescriptors(store, {
          includeInvisible: params.includeInvisible ?? includeInvisibleDefault,
          includeDisabled: includeDisabledCommandsInList,
        });
        return {
          llmResult: {
            success: true,
            commands: descriptors,
            details: `Found ${descriptors.length} commands.`,
          } satisfies ListCommandsToolLlmResult,
        };
      },
    },
    [executeToolName]: {
      name: executeToolName,
      description: `Execute a room command by ID.
Call list_commands first to discover valid command IDs and input requirements.`,
      parameters: ExecuteCommandToolParameters,
      execute: async ({commandId, input}: ExecuteCommandToolParameters) => {
        const state = store.getState();
        if (!hasCommandSliceState(state)) {
          return {
            llmResult: {
              success: false,
              commandId,
              errorMessage: 'Command registry is not available in this room.',
            } satisfies ExecuteCommandToolLlmResult,
          };
        }

        if (!state.commands.registry[commandId]) {
          return {
            llmResult: {
              success: false,
              commandId,
              errorMessage: `Unknown command ID "${commandId}".`,
            } satisfies ExecuteCommandToolLlmResult,
          };
        }

        try {
          await state.commands.executeCommand(commandId, input);
          return {
            llmResult: {
              success: true,
              commandId,
              details: `Executed command "${commandId}".`,
            } satisfies ExecuteCommandToolLlmResult,
          };
        } catch (error) {
          return {
            llmResult: {
              success: false,
              commandId,
              errorMessage: toErrorMessage(error),
            } satisfies ExecuteCommandToolLlmResult,
          };
        }
      },
    },
  };
}

function getCommandDescriptors<RS extends BaseRoomStoreState>(
  store: StoreApi<RS>,
  options: {
    includeInvisible: boolean;
    includeDisabled: boolean;
  },
): CommandToolDescriptor[] {
  const state = store.getState();
  if (!hasCommandSliceState(state)) {
    return [];
  }

  const context = createRoomCommandExecutionContext(store);
  const commands = Object.values(state.commands.registry)
    .filter((command) => {
      if (options.includeInvisible) {
        return true;
      }
      return isCommandVisible(command, context);
    })
    .map((command) => {
      const enabled = isCommandEnabled(command, context);
      return {
        id: command.id,
        name: command.name,
        description: command.description,
        group: command.group,
        keywords: command.keywords,
        enabled,
        requiresInput: doesCommandRequireInput(command),
        inputDescription: command.inputDescription,
      } satisfies CommandToolDescriptor;
    })
    .filter((command) => (options.includeDisabled ? true : command.enabled));

  commands.sort((first, second) => first.name.localeCompare(second.name));
  return commands;
}

function isCommandVisible<RS extends BaseRoomStoreState>(
  command: RegisteredRoomCommand<RS>,
  context: RoomCommandExecutionContext<RS>,
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

function isCommandEnabled<RS extends BaseRoomStoreState>(
  command: RegisteredRoomCommand<RS>,
  context: RoomCommandExecutionContext<RS>,
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

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
