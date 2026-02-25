import {StoreApi} from 'zustand';
import {BaseRoomStoreState} from './BaseRoomStore';
import {
  hasCommandSliceState,
  RoomCommandDescriptor,
  RoomCommandInvocationOptions,
  RoomCommandListOptions,
  RoomCommandPortableSchema,
  RoomCommandResult,
} from './CommandSlice';

export type CommandCliAdapterOptions = {
  defaultActor?: string;
  defaultTraceId?: string;
  defaultMetadata?: Record<string, unknown>;
};

export type CommandCliAdapter = {
  listCommands: (
    options?: Omit<RoomCommandListOptions, 'surface'>,
  ) => RoomCommandDescriptor[];
  executeCommand: (
    commandId: string,
    input?: unknown,
    invocation?: Omit<RoomCommandInvocationOptions, 'surface'>,
  ) => Promise<RoomCommandResult>;
};

export type CommandMcpToolDescriptor = {
  name: string;
  commandId: string;
  title: string;
  description?: string;
  inputSchema?: RoomCommandPortableSchema;
  annotations?: {
    readOnlyHint?: boolean;
    idempotentHint?: boolean;
    destructiveHint?: boolean;
    requiresConfirmation?: boolean;
  };
};

export type CommandMcpAdapterOptions = {
  toolNamePrefix?: string;
  includeInvisible?: boolean;
  includeDisabled?: boolean;
  includeInputSchema?: boolean;
  mapToolName?: (commandId: string) => string;
  defaultActor?: string;
  defaultTraceId?: string;
  defaultMetadata?: Record<string, unknown>;
};

export type CommandMcpAdapter = {
  listTools: () => CommandMcpToolDescriptor[];
  resolveCommandId: (toolName: string) => string | undefined;
  callTool: (
    toolName: string,
    input?: unknown,
    invocation?: Omit<RoomCommandInvocationOptions, 'surface'>,
  ) => Promise<RoomCommandResult>;
};

const DEFAULT_MCP_TOOL_PREFIX = 'command.';

export function createCommandCliAdapter<RS extends BaseRoomStoreState>(
  store: StoreApi<RS>,
  options?: CommandCliAdapterOptions,
): CommandCliAdapter {
  return {
    listCommands: (listOptions) => {
      const state = store.getState();
      if (!hasCommandSliceState(state)) {
        return [];
      }
      return state.commands.listCommands({
        ...listOptions,
        surface: 'cli',
        actor: listOptions?.actor ?? options?.defaultActor,
        traceId: listOptions?.traceId ?? options?.defaultTraceId,
        metadata: listOptions?.metadata ?? options?.defaultMetadata,
      });
    },
    executeCommand: async (commandId, input, invocation) => {
      const state = store.getState();
      if (!hasCommandSliceState(state)) {
        return {
          success: false,
          commandId,
          code: 'command-registry-unavailable',
          error: 'Command registry is not available.',
        };
      }
      return await state.commands.invokeCommand(commandId, input, {
        surface: 'cli',
        actor: invocation?.actor ?? options?.defaultActor,
        traceId: invocation?.traceId ?? options?.defaultTraceId,
        metadata: invocation?.metadata ?? options?.defaultMetadata,
      });
    },
  };
}

export function createCommandMcpAdapter<RS extends BaseRoomStoreState>(
  store: StoreApi<RS>,
  options?: CommandMcpAdapterOptions,
): CommandMcpAdapter {
  const toolNamePrefix = options?.toolNamePrefix ?? DEFAULT_MCP_TOOL_PREFIX;

  const toolNameFromCommandId =
    options?.mapToolName ??
    ((commandId: string) => `${toolNamePrefix}${sanitizeToolName(commandId)}`);

  const listDescriptors = () => {
    const state = store.getState();
    if (!hasCommandSliceState(state)) {
      return [] as RoomCommandDescriptor[];
    }
    return state.commands.listCommands({
      surface: 'mcp',
      includeInvisible: options?.includeInvisible ?? false,
      includeDisabled: options?.includeDisabled ?? false,
      includeInputSchema: options?.includeInputSchema ?? true,
      actor: options?.defaultActor,
      traceId: options?.defaultTraceId,
      metadata: options?.defaultMetadata,
    });
  };

  const listTools = (): CommandMcpToolDescriptor[] =>
    listDescriptors().map((descriptor) => ({
      name: toolNameFromCommandId(descriptor.id),
      commandId: descriptor.id,
      title: descriptor.name,
      description: descriptor.description,
      inputSchema: descriptor.inputSchema,
      annotations: {
        readOnlyHint: descriptor.readOnly,
        idempotentHint: descriptor.idempotent,
        destructiveHint: descriptor.riskLevel === 'high',
        requiresConfirmation: descriptor.requiresConfirmation,
      },
    }));

  const resolveCommandId = (toolName: string): string | undefined => {
    const tools = listTools();
    return tools.find((tool) => tool.name === toolName)?.commandId;
  };

  return {
    listTools,
    resolveCommandId,
    callTool: async (toolName, input, invocation) => {
      const commandId = resolveCommandId(toolName);
      if (!commandId) {
        return {
          success: false,
          commandId: toolName,
          code: 'command-tool-not-found',
          error: `Unknown command tool "${toolName}".`,
        };
      }

      const state = store.getState();
      if (!hasCommandSliceState(state)) {
        return {
          success: false,
          commandId,
          code: 'command-registry-unavailable',
          error: 'Command registry is not available.',
        };
      }

      return await state.commands.invokeCommand(commandId, input, {
        surface: 'mcp',
        actor: invocation?.actor ?? options?.defaultActor,
        traceId: invocation?.traceId ?? options?.defaultTraceId,
        metadata: invocation?.metadata ?? options?.defaultMetadata,
      });
    },
  };
}

function sanitizeToolName(commandId: string): string {
  return commandId.replace(/[^a-zA-Z0-9._-]/g, '_');
}
