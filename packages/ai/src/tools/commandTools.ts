import {tool} from 'ai';
import type {ToolSet} from 'ai';
import {hasCommandSliceState} from '@sqlrooms/room-shell';
import type {
  BaseRoomStoreState,
  RoomCommandDescriptor,
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
  includeDisabled: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      'Whether to include currently disabled commands (default: true).',
    ),
  includeInputSchema: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      'Whether to include portable input schemas in the listed command descriptors.',
    ),
});

export type ListCommandsToolParameters = z.infer<
  typeof ListCommandsToolParameters
>;

export type CommandToolDescriptor = RoomCommandDescriptor;

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
  result?: {
    code?: string;
    message?: string;
    data?: unknown;
  };
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
): ToolSet {
  const listToolName = options?.listToolName ?? DEFAULT_LIST_TOOL_NAME;
  const executeToolName = options?.executeToolName ?? DEFAULT_EXECUTE_TOOL_NAME;

  return {
    [listToolName]: tool({
      description: `List available room commands, including whether they are enabled and whether they require input.
Use this before executing commands so you can pick a valid command ID and understand input expectations.`,
      inputSchema: ListCommandsToolParameters,
      execute: async (params: ListCommandsToolParameters) => {
        const state = store.getState();
        if (!hasCommandSliceState(state)) {
          return {
            success: false,
            errorMessage: 'Command registry is not available in this room.',
          } satisfies ListCommandsToolLlmResult;
        }

        const descriptors = state.commands.listCommands({
          surface: 'ai',
          includeInvisible: params.includeInvisible,
          includeDisabled: params.includeDisabled,
          includeInputSchema: params.includeInputSchema,
        });

        return {
          success: true,
          commands: descriptors,
          details: `Found ${descriptors.length} commands.`,
        } satisfies ListCommandsToolLlmResult;
      },
    }),
    [executeToolName]: tool({
      description: `Execute a room command by ID.
Call ${listToolName} first to discover valid command IDs and input requirements.`,
      inputSchema: ExecuteCommandToolParameters,
      execute: async ({commandId, input}: ExecuteCommandToolParameters) => {
        const state = store.getState();
        if (!hasCommandSliceState(state)) {
          return {
            success: false,
            commandId,
            errorMessage: 'Command registry is not available in this room.',
          } satisfies ExecuteCommandToolLlmResult;
        }

        if (!state.commands.getCommand(commandId)) {
          return {
            success: false,
            commandId,
            errorMessage: `Unknown command ID "${commandId}".`,
          } satisfies ExecuteCommandToolLlmResult;
        }

        const result = await state.commands.invokeCommand(commandId, input, {
          surface: 'ai',
        });
        if (result.success) {
          return {
            success: true,
            commandId,
            details: `Executed command "${commandId}".`,
            result: {
              code: result.code,
              message: result.message,
              data: result.data,
            },
          } satisfies ExecuteCommandToolLlmResult;
        }
        return {
          success: false,
          commandId,
          errorMessage: result.error ?? 'Command execution failed.',
          result: {
            code: result.code,
            message: result.message,
          },
        } satisfies ExecuteCommandToolLlmResult;
      },
    }),
  };
}
