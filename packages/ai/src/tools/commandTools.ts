import {tool} from 'ai';
import type {Tool, ToolSet} from 'ai';
import {hasCommandSliceState} from '@sqlrooms/room-shell';
import type {
  BaseRoomStoreState,
  RoomCommandDescriptor,
  RoomCommandRiskLevel,
  RoomCommandSurface,
  StoreApi,
} from '@sqlrooms/room-shell';
import {z} from 'zod';

const CommandSurfaceSchema = z.enum([
  'palette',
  'ai',
  'cli',
  'mcp',
  'api',
  'unknown',
]);

const CommandRiskLevelSchema = z.enum(['low', 'medium', 'high']);

export const SearchCommandsToolParameters = z.object({
  query: z
    .string()
    .optional()
    .default('')
    .describe('Intent or command ID to search for.'),
  surface: CommandSurfaceSchema.optional().describe(
    'Command surface used to evaluate command visibility/enabled state. Defaults to the command tool defaultSurface option.',
  ),
  includeHidden: z
    .boolean()
    .optional()
    .default(false)
    .describe('Whether to include commands hidden from user-facing UIs.'),
  includeDisabled: z
    .boolean()
    .optional()
    .default(false)
    .describe('Whether to include currently disabled commands.'),
  limit: z
    .number()
    .int()
    .positive()
    .max(50)
    .optional()
    .default(10)
    .describe('Maximum number of matching commands to return.'),
  resourceType: z
    .string()
    .optional()
    .describe(
      'Optional resource hint, such as artifact, block-document, dashboard, or sql.',
    ),
  action: z
    .string()
    .optional()
    .describe(
      'Optional action hint, such as create, rename, run, add, or remove.',
    ),
  riskLevel: CommandRiskLevelSchema.optional().describe(
    'Optional risk-level filter.',
  ),
  includeInputSchema: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'Whether to include portable input schemas. Prefer get_command for one selected command.',
    ),
});

export type SearchCommandsToolParameters = z.infer<
  typeof SearchCommandsToolParameters
>;

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

export type CommandToolSearchDescriptor = Omit<
  RoomCommandDescriptor,
  'owner' | 'inputDescription' | 'inputSchema' | 'keystrokes' | 'shortcut'
> & {
  inputSchema?: RoomCommandDescriptor['inputSchema'];
  score: number;
  matchReason: string;
  metadataWarnings?: string[];
};

export type SearchCommandsToolLlmResult = {
  success: boolean;
  commands?: CommandToolSearchDescriptor[];
  details?: string;
  errorMessage?: string;
};

export type ListCommandsToolLlmResult = {
  success: boolean;
  commands?: CommandToolDescriptor[];
  details?: string;
  errorMessage?: string;
};

export const GetCommandToolParameters = z.object({
  commandId: z.string().describe('The command ID to inspect.'),
  surface: CommandSurfaceSchema.optional().describe(
    'Command surface used to evaluate command visibility/enabled state. Defaults to the command tool defaultSurface option.',
  ),
  includeHidden: z
    .boolean()
    .optional()
    .default(true)
    .describe('Whether hidden commands may be returned.'),
  includeDisabled: z
    .boolean()
    .optional()
    .default(true)
    .describe('Whether disabled commands may be returned.'),
});

export type GetCommandToolParameters = z.infer<typeof GetCommandToolParameters>;

export type GetCommandToolLlmResult = {
  success: boolean;
  command?: CommandToolDescriptor;
  details?: string;
  errorMessage?: string;
};

export const ExecuteCommandToolParameters = z.object({
  commandId: z.string().describe('The command ID to execute.'),
  input: z
    .unknown()
    .optional()
    .describe('Optional command input. Must satisfy the command input schema.'),
  confirmed: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'Set true only after the user explicitly confirms a high-risk or confirmation-required command.',
    ),
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

type CommandToolExecutionContext = {
  sessionId?: string;
  skillId?: string;
  traceId?: string;
  toolCallId?: string;
  metadata?: Record<string, unknown>;
};

export type CommandToolsOptions = {
  searchToolName?: string;
  getToolName?: string;
  listToolName?: string;
  executeToolName?: string;
  defaultSurface?: RoomCommandSurface;
  defaultActor?: string;
  defaultTraceId?: string;
  defaultSkillId?: string;
  defaultMetadata?: Record<string, unknown>;
  includeInvisibleCommandsByDefault?: boolean;
  includeDisabledCommandsInList?: boolean;
};

const DEFAULT_SEARCH_TOOL_NAME = 'search_commands';
const DEFAULT_GET_TOOL_NAME = 'get_command';
const DEFAULT_LIST_TOOL_NAME = 'list_commands';
const DEFAULT_EXECUTE_TOOL_NAME = 'execute_command';

/**
 * The typed shape returned by {@link createCommandTools} when using the default tool names.
 * Consumed by {@link createDefaultAiTools} to give its return type literal string keys.
 */
export type DefaultCommandTools = {
  search_commands: Tool<
    SearchCommandsToolParameters,
    SearchCommandsToolLlmResult
  >;
  get_command: Tool<GetCommandToolParameters, GetCommandToolLlmResult>;
  list_commands: Tool<ListCommandsToolParameters, ListCommandsToolLlmResult>;
  execute_command: Tool<
    ExecuteCommandToolParameters,
    ExecuteCommandToolLlmResult
  >;
};

export function createCommandTools<RS extends BaseRoomStoreState>(
  store: StoreApi<RS>,
): DefaultCommandTools;
export function createCommandTools<RS extends BaseRoomStoreState>(
  store: StoreApi<RS>,
  options: CommandToolsOptions,
): ToolSet;
export function createCommandTools<RS extends BaseRoomStoreState>(
  store: StoreApi<RS>,
  options?: CommandToolsOptions,
): ToolSet {
  const searchToolName = options?.searchToolName ?? DEFAULT_SEARCH_TOOL_NAME;
  const getToolName = options?.getToolName ?? DEFAULT_GET_TOOL_NAME;
  const listToolName = options?.listToolName ?? DEFAULT_LIST_TOOL_NAME;
  const executeToolName = options?.executeToolName ?? DEFAULT_EXECUTE_TOOL_NAME;
  const defaultSurface = options?.defaultSurface ?? 'ai';

  return {
    [searchToolName]: tool({
      description: `Search available room commands by intent or command ID.
Use this for routine command discovery before calling ${getToolName} for the selected command schema and ${executeToolName} to run it.`,
      inputSchema: SearchCommandsToolParameters,
      execute: async (
        params: SearchCommandsToolParameters,
        executionOptions,
      ) => {
        const context = executionOptions as
          | CommandToolExecutionContext
          | undefined;
        const state = store.getState();
        if (!hasCommandSliceState(state)) {
          return {
            success: false,
            errorMessage: 'Command registry is not available in this room.',
          } satisfies SearchCommandsToolLlmResult;
        }

        const descriptors = state.commands.listCommands({
          ...createCommandToolInvocationOptions(
            params.surface ?? defaultSurface,
            options,
            context,
          ),
          includeInvisible: params.includeHidden,
          includeDisabled: params.includeDisabled,
          includeInputSchema: params.includeInputSchema,
        });
        const rankedCommands = rankCommandDescriptors(descriptors, params);

        return {
          success: true,
          commands: rankedCommands
            .slice(0, params.limit)
            .map(({descriptor, score}) =>
              createSearchDescriptor(
                descriptor,
                score,
                params,
                params.includeInputSchema,
              ),
            ),
          details: `Found ${rankedCommands.length} matching commands.`,
        } satisfies SearchCommandsToolLlmResult;
      },
    }),
    [getToolName]: tool({
      description: `Get full metadata and input schema for one room command.
Call this after ${searchToolName} and before ${executeToolName} when the command requires input.`,
      inputSchema: GetCommandToolParameters,
      execute: async (params: GetCommandToolParameters, executionOptions) => {
        const context = executionOptions as
          | CommandToolExecutionContext
          | undefined;
        const state = store.getState();
        if (!hasCommandSliceState(state)) {
          return {
            success: false,
            errorMessage: 'Command registry is not available in this room.',
          } satisfies GetCommandToolLlmResult;
        }

        const descriptors = state.commands.listCommands({
          ...createCommandToolInvocationOptions(
            params.surface ?? defaultSurface,
            options,
            context,
          ),
          includeInvisible: params.includeHidden,
          includeDisabled: params.includeDisabled,
          includeInputSchema: true,
        });
        const command = descriptors.find(
          (descriptor) => descriptor.id === params.commandId,
        );
        if (!command) {
          return {
            success: false,
            errorMessage: `Unknown command ID "${params.commandId}".`,
          } satisfies GetCommandToolLlmResult;
        }

        return {
          success: true,
          command,
          details: `Found command "${params.commandId}".`,
        } satisfies GetCommandToolLlmResult;
      },
    }),
    [listToolName]: tool({
      description: `List available room commands for broad exploration or debugging.
For routine command use, prefer ${searchToolName}, then ${getToolName} for the selected command schema, then ${executeToolName}.`,
      inputSchema: ListCommandsToolParameters,
      execute: async (params: ListCommandsToolParameters, executionOptions) => {
        const context = executionOptions as
          | CommandToolExecutionContext
          | undefined;
        const state = store.getState();
        if (!hasCommandSliceState(state)) {
          return {
            success: false,
            errorMessage: 'Command registry is not available in this room.',
          } satisfies ListCommandsToolLlmResult;
        }

        const descriptors = state.commands.listCommands({
          ...createCommandToolInvocationOptions(
            defaultSurface,
            options,
            context,
          ),
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
Call ${searchToolName} first to discover valid command IDs. Call ${getToolName} when you need the selected command input schema.`,
      inputSchema: ExecuteCommandToolParameters,
      execute: async (
        {commandId, input, confirmed}: ExecuteCommandToolParameters,
        executionOptions,
      ) => {
        const context = executionOptions as
          | CommandToolExecutionContext
          | undefined;
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

        const descriptor = state.commands
          .listCommands({
            ...createCommandToolInvocationOptions(
              defaultSurface,
              options,
              context,
            ),
            includeInvisible: true,
            includeDisabled: true,
            includeInputSchema: false,
          })
          .find((command) => command.id === commandId);
        if (
          descriptor &&
          !confirmed &&
          (descriptor.riskLevel === 'high' || descriptor.requiresConfirmation)
        ) {
          return {
            success: false,
            commandId,
            errorMessage: `Command "${commandId}" requires explicit user confirmation before execution.`,
            result: {
              code: 'command-confirmation-required',
              message:
                'Ask the user to confirm this high-risk command, then retry with confirmed: true.',
              data: {
                riskLevel: descriptor.riskLevel,
                requiresConfirmation: descriptor.requiresConfirmation,
              },
            },
          } satisfies ExecuteCommandToolLlmResult;
        }

        const result = await state.commands.invokeCommand(
          commandId,
          input,
          createCommandToolInvocationOptions(defaultSurface, options, context),
        );
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
    // Single cast required: TypeScript cannot narrow computed property names
    // ([searchToolName], [getToolName], [listToolName], [executeToolName]) to
    // their literal string types.
  } as DefaultCommandTools;
}

type RankedCommandDescriptor = {
  descriptor: RoomCommandDescriptor;
  score: number;
};

function createCommandToolInvocationOptions(
  surface: RoomCommandSurface,
  options: CommandToolsOptions | undefined,
  context: CommandToolExecutionContext | undefined,
) {
  const metadata: Record<string, unknown> = {
    ...(options?.defaultMetadata ?? {}),
    ...(context?.metadata ?? {}),
  };
  if (typeof context?.sessionId === 'string') {
    metadata.aiSessionId = context.sessionId;
  }
  const skillId = context?.skillId ?? options?.defaultSkillId;
  if (typeof skillId === 'string') {
    metadata.skillId = skillId;
  }
  if (typeof context?.toolCallId === 'string') {
    metadata.toolCallId = context.toolCallId;
  }
  const traceId =
    context?.traceId ?? options?.defaultTraceId ?? context?.toolCallId;

  return {
    surface,
    ...(options?.defaultActor ? {actor: options.defaultActor} : {}),
    ...(traceId ? {traceId} : {}),
    ...(Object.keys(metadata).length > 0 ? {metadata} : {}),
  };
}

function rankCommandDescriptors(
  descriptors: RoomCommandDescriptor[],
  params: SearchCommandsToolParameters,
): RankedCommandDescriptor[] {
  const query = normalizeSearchText(params.query);
  const hints = [
    params.resourceType ? normalizeSearchText(params.resourceType) : '',
    params.action ? normalizeSearchText(params.action) : '',
  ].filter(Boolean);
  const tokens = tokenizeSearchText([query, ...hints].join(' '));
  const hasSearchTerms = Boolean(query || hints.length > 0);

  return descriptors
    .filter((descriptor) =>
      params.riskLevel ? descriptor.riskLevel === params.riskLevel : true,
    )
    .map((descriptor) => ({
      descriptor,
      score: scoreCommandDescriptor(
        descriptor,
        query,
        tokens,
        params.riskLevel,
      ),
    }))
    .filter(({score}) => !hasSearchTerms || score > 0)
    .sort(compareRankedCommandDescriptors);
}

function scoreCommandDescriptor(
  descriptor: RoomCommandDescriptor,
  query: string,
  tokens: string[],
  riskLevel?: RoomCommandRiskLevel,
): number {
  let score = 0;
  const id = normalizeSearchText(descriptor.id);
  const name = normalizeSearchText(descriptor.name);
  const description = normalizeSearchText(descriptor.description);
  const group = normalizeSearchText(descriptor.group);
  const keywords = (descriptor.keywords ?? []).map(normalizeSearchText);
  const shortcut = normalizeSearchText(descriptor.shortcut);

  if (query) {
    if (id === query) {
      score += 1000;
    } else if (id.includes(query)) {
      score += 300;
    }
    if (name === query) {
      score += 500;
    } else if (name.includes(query)) {
      score += 220;
    }
    if (keywords.includes(query)) {
      score += 180;
    }
    if (description.includes(query)) {
      score += 80;
    }
    if (group.includes(query)) {
      score += 60;
    }
    if (shortcut && shortcut.includes(query)) {
      score += 40;
    }
  }

  for (const token of tokens) {
    if (id === token) {
      score += 120;
    } else if (id.includes(token)) {
      score += 50;
    }
    if (name.includes(token)) {
      score += 45;
    }
    if (keywords.some((keyword) => keyword === token)) {
      score += 40;
    } else if (keywords.some((keyword) => keyword.includes(token))) {
      score += 20;
    }
    if (description.includes(token)) {
      score += 15;
    }
    if (group.includes(token)) {
      score += 10;
    }
  }

  if (riskLevel && descriptor.riskLevel === riskLevel) {
    score += 20;
  }
  if (descriptor.enabled) {
    score += 10;
  }
  if (descriptor.visible) {
    score += 5;
  }
  if (descriptor.requiresInput) {
    score += 1;
  }

  return score;
}

function createSearchDescriptor(
  descriptor: RoomCommandDescriptor,
  score: number,
  params: SearchCommandsToolParameters,
  includeInputSchema: boolean,
): CommandToolSearchDescriptor {
  const metadataWarnings = getCommandMetadataWarnings(descriptor);
  return {
    id: descriptor.id,
    name: descriptor.name,
    description: descriptor.description,
    group: descriptor.group,
    keywords: descriptor.keywords,
    enabled: descriptor.enabled,
    visible: descriptor.visible,
    requiresInput: descriptor.requiresInput,
    readOnly: descriptor.readOnly,
    idempotent: descriptor.idempotent,
    riskLevel: descriptor.riskLevel,
    requiresConfirmation: descriptor.requiresConfirmation,
    ...(includeInputSchema ? {inputSchema: descriptor.inputSchema} : {}),
    score,
    matchReason: createCommandMatchReason(descriptor, params),
    ...(metadataWarnings.length > 0 ? {metadataWarnings} : {}),
  };
}

function createCommandMatchReason(
  descriptor: RoomCommandDescriptor,
  params: SearchCommandsToolParameters,
): string {
  const query = normalizeSearchText(params.query);
  const action = normalizeSearchText(params.action);
  const resourceType = normalizeSearchText(params.resourceType);
  const keywords = (descriptor.keywords ?? []).map(normalizeSearchText);
  const matches: string[] = [];

  if (query) {
    const id = normalizeSearchText(descriptor.id);
    const name = normalizeSearchText(descriptor.name);
    const description = normalizeSearchText(descriptor.description);
    const group = normalizeSearchText(descriptor.group);
    if (id === query) {
      matches.push('exact command ID match');
    } else if (id.includes(query)) {
      matches.push('command ID match');
    } else if (name.includes(query)) {
      matches.push('name match');
    } else if (keywords.includes(query)) {
      matches.push('keyword match');
    } else if (description.includes(query)) {
      matches.push('description match');
    } else if (group.includes(query)) {
      matches.push('group match');
    }
  }

  if (action && keywords.includes(action)) {
    matches.push(`action keyword "${params.action}"`);
  }
  if (resourceType && keywords.includes(resourceType)) {
    matches.push(`resource keyword "${params.resourceType}"`);
  }
  if (params.riskLevel && descriptor.riskLevel === params.riskLevel) {
    matches.push(`risk ${params.riskLevel}`);
  }
  if (descriptor.enabled) {
    matches.push('enabled');
  }
  if (descriptor.visible) {
    matches.push('visible');
  }

  return matches.slice(0, 3).join(', ') || 'stable catalog ordering';
}

function getCommandMetadataWarnings(
  descriptor: RoomCommandDescriptor,
): string[] {
  const warnings: string[] = [];
  if (!descriptor.description?.trim()) {
    warnings.push('missing description');
  }
  if (!descriptor.keywords || descriptor.keywords.length === 0) {
    warnings.push('missing keywords');
  }
  return warnings;
}

function compareRankedCommandDescriptors(
  first: RankedCommandDescriptor,
  second: RankedCommandDescriptor,
): number {
  if (first.score !== second.score) {
    return second.score - first.score;
  }
  if (first.descriptor.enabled !== second.descriptor.enabled) {
    return first.descriptor.enabled ? -1 : 1;
  }
  if (first.descriptor.visible !== second.descriptor.visible) {
    return first.descriptor.visible ? -1 : 1;
  }

  const firstGroup = first.descriptor.group ?? '';
  const secondGroup = second.descriptor.group ?? '';
  if (firstGroup !== secondGroup) {
    return firstGroup.localeCompare(secondGroup);
  }

  const nameComparison = first.descriptor.name.localeCompare(
    second.descriptor.name,
  );
  if (nameComparison !== 0) {
    return nameComparison;
  }
  return first.descriptor.id.localeCompare(second.descriptor.id);
}

function tokenizeSearchText(value: string): string[] {
  return Array.from(
    new Set(normalizeSearchText(value).split(' ').filter(Boolean)),
  );
}

function normalizeSearchText(value: string | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, ' ')
    .trim();
}
