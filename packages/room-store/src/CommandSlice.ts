import {produce} from 'immer';
import type {ComponentType} from 'react';
import {StoreApi} from 'zustand';
import {z, ZodType} from 'zod';
import {BaseRoomStoreState, createSlice, StateCreator} from './BaseRoomStore';

const DEFAULT_COMMAND_OWNER = 'global';
const DEFAULT_COMMAND_SURFACE: RoomCommandSurface = 'unknown';

export type RoomCommandSurface =
  | 'palette'
  | 'ai'
  | 'cli'
  | 'mcp'
  | 'api'
  | 'unknown';

export type RoomCommandInvocation = {
  surface: RoomCommandSurface;
  actor?: string;
  traceId?: string;
  metadata?: Record<string, unknown>;
};

export type RoomCommandInvocationOptions = Partial<RoomCommandInvocation>;

export type RoomCommandExecutionContext<
  RS extends BaseRoomStoreState = BaseRoomStoreState,
> = {
  store: StoreApi<RS>;
  getState: () => RS;
  invocation: RoomCommandInvocation;
};

export type RoomCommandPredicate<
  RS extends BaseRoomStoreState = BaseRoomStoreState,
> = (context: RoomCommandExecutionContext<RS>) => boolean;

export type RoomCommandInputComponentProps = {
  commandId: string;
  commandName: string;
  isSubmitting: boolean;
  error?: string;
  onSubmit: (input: unknown) => void | Promise<void>;
  onCancel: () => void;
};

export type RoomCommandInputComponent =
  ComponentType<RoomCommandInputComponentProps>;

export type RoomCommandRiskLevel = 'low' | 'medium' | 'high';

export type RoomCommandPolicyMetadata = {
  readOnly?: boolean;
  idempotent?: boolean;
  riskLevel?: RoomCommandRiskLevel;
  requiresConfirmation?: boolean;
};

export type RoomCommandUiMetadata = {
  shortcut?: string;
  inputComponent?: RoomCommandInputComponent;
  hidden?: boolean;
};

export type RoomCommandResult<TData = unknown> = {
  success: boolean;
  commandId: string;
  message?: string;
  code?: string;
  data?: TData;
  error?: string;
};

export type RoomCommandExecuteOutput<TData = unknown> =
  | RoomCommandResult<TData>
  | TData
  | void;

export type RoomCommandPortableSchema = {
  type?: string;
  description?: string;
  enum?: unknown[];
  const?: unknown;
  default?: unknown;
  nullable?: boolean;
  optional?: boolean;
  properties?: Record<string, RoomCommandPortableSchema>;
  required?: string[];
  items?: RoomCommandPortableSchema;
  anyOf?: RoomCommandPortableSchema[];
};

export type RoomCommand<RS extends BaseRoomStoreState = BaseRoomStoreState> = {
  id: string;
  name: string;
  description?: string;
  group?: string;
  keywords?: string[];
  inputSchema?: ZodType<unknown>;
  inputDescription?: string;
  validateInput?: (
    input: unknown,
    context: RoomCommandExecutionContext<RS>,
  ) => void | Promise<void>;
  execute: (
    context: RoomCommandExecutionContext<RS>,
    input?: unknown,
  ) => RoomCommandExecuteOutput | Promise<RoomCommandExecuteOutput>;
  isVisible?: RoomCommandPredicate<RS>;
  isEnabled?: RoomCommandPredicate<RS>;
  metadata?: RoomCommandPolicyMetadata;
  ui?: RoomCommandUiMetadata;
  /** @deprecated Use ui?.shortcut */
  shortcut?: string;
  /** @deprecated Use ui?.inputComponent */
  inputComponent?: RoomCommandInputComponent;
  /** @deprecated Use metadata?.readOnly */
  readOnly?: boolean;
  /** @deprecated Use metadata?.idempotent */
  idempotent?: boolean;
  /** @deprecated Use metadata?.riskLevel */
  riskLevel?: RoomCommandRiskLevel;
  /** @deprecated Use metadata?.requiresConfirmation */
  requiresConfirmation?: boolean;
};

export type RegisteredRoomCommand<
  RS extends BaseRoomStoreState = BaseRoomStoreState,
> = RoomCommand<RS> & {
  owner: string;
};

export type RoomCommandDescriptor = {
  id: string;
  owner: string;
  name: string;
  description?: string;
  group?: string;
  keywords?: string[];
  enabled: boolean;
  visible: boolean;
  requiresInput: boolean;
  inputDescription?: string;
  inputSchema?: RoomCommandPortableSchema;
  shortcut?: string;
  readOnly: boolean;
  idempotent: boolean;
  riskLevel: RoomCommandRiskLevel;
  requiresConfirmation: boolean;
};

export type RoomCommandListOptions = RoomCommandInvocationOptions & {
  includeInvisible?: boolean;
  includeDisabled?: boolean;
  includeInputSchema?: boolean;
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
    getCommand: (commandId: string) => RegisteredRoomCommand<RS> | undefined;
    listCommands: (options?: RoomCommandListOptions) => RoomCommandDescriptor[];
    invokeCommand: (
      commandId: string,
      input?: unknown,
      invocation?: RoomCommandInvocationOptions,
    ) => Promise<RoomCommandResult>;
    executeCommand: (
      commandId: string,
      input?: unknown,
      invocation?: RoomCommandInvocationOptions,
    ) => Promise<void>;
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
                if (
                  existingCommand &&
                  existingCommand.owner !== normalizedOwner
                ) {
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
        getCommand: (commandId) => get().commands.registry[commandId],
        listCommands: (options) => {
          const invocation = normalizeInvocation(options);
          const context = createRoomCommandExecutionContext(
            store as StoreApi<RS>,
            invocation,
          );
          const includeInvisible = options?.includeInvisible ?? false;
          const includeDisabled = options?.includeDisabled ?? true;
          const includeInputSchema = options?.includeInputSchema ?? true;

          const descriptors = Object.values(get().commands.registry)
            .map((command) =>
              createCommandDescriptor(command, context, includeInputSchema),
            )
            .filter((descriptor) =>
              includeInvisible ? true : descriptor.visible,
            )
            .filter((descriptor) =>
              includeDisabled ? true : descriptor.enabled,
            );

          descriptors.sort((first, second) => {
            const firstGroup = first.group ?? '';
            const secondGroup = second.group ?? '';
            if (firstGroup !== secondGroup) {
              return firstGroup.localeCompare(secondGroup);
            }
            return first.name.localeCompare(second.name);
          });
          return descriptors;
        },
        invokeCommand: async (commandId, input, invocationOptions) => {
          const command = get().commands.registry[commandId];
          if (!command) {
            return {
              success: false,
              commandId,
              code: 'command-not-found',
              error: `Unknown command "${commandId}".`,
            };
          }

          const invocation = normalizeInvocation(invocationOptions);
          const executionContext = createRoomCommandExecutionContext(
            store as StoreApi<RS>,
            invocation,
          );

          if (!resolveCommandEnabled(command, executionContext)) {
            return {
              success: false,
              commandId: command.id,
              code: 'command-disabled',
              error: `Command "${command.name}" is currently disabled.`,
            };
          }

          try {
            const validatedInput = await validateCommandInput(
              command,
              input,
              executionContext,
            );
            const rawResult = await command.execute(
              executionContext,
              validatedInput,
            );
            return normalizeCommandExecuteResult(command.id, rawResult);
          } catch (error) {
            get().room.captureException(error);
            return {
              success: false,
              commandId: command.id,
              code: 'command-execution-error',
              error: toErrorMessage(error),
            };
          }
        },
        executeCommand: async (commandId, input, invocation) => {
          const result = await get().commands.invokeCommand(
            commandId,
            input,
            invocation,
          );
          if (!result.success) {
            throw new Error(
              result.error ??
                result.message ??
                `Failed to execute ${commandId}`,
            );
          }
        },
      },
    }),
  );
}

export function createRoomCommandExecutionContext<
  RS extends BaseRoomStoreState,
>(
  store: StoreApi<RS>,
  invocation?: RoomCommandInvocationOptions,
): RoomCommandExecutionContext<RS> {
  return {
    store,
    getState: () => store.getState(),
    invocation: normalizeInvocation(invocation),
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
    'listCommands' in commands &&
    typeof commands.listCommands === 'function' &&
    'invokeCommand' in commands &&
    typeof commands.invokeCommand === 'function' &&
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

export function listCommandsFromStore<RS extends BaseRoomStoreState>(
  store: StoreApi<RS>,
  options?: RoomCommandListOptions,
): RoomCommandDescriptor[] {
  const state = store.getState();
  if (!hasCommandSliceState(state)) {
    return [];
  }
  return state.commands.listCommands(options);
}

export async function invokeCommandFromStore<RS extends BaseRoomStoreState>(
  store: StoreApi<RS>,
  commandId: string,
  input?: unknown,
  invocation?: RoomCommandInvocationOptions,
): Promise<RoomCommandResult> {
  const state = store.getState();
  if (!hasCommandSliceState(state)) {
    return {
      success: false,
      commandId,
      code: 'command-registry-unavailable',
      error: 'Command registry is not available.',
    };
  }
  return await state.commands.invokeCommand(commandId, input, invocation);
}

export async function validateCommandInput<RS extends BaseRoomStoreState>(
  command: RoomCommand<RS>,
  input: unknown,
  context: RoomCommandExecutionContext<RS>,
): Promise<unknown> {
  const parsedInput = command.inputSchema
    ? parseCommandInput(command.inputSchema, input)
    : input;

  if (command.validateInput) {
    await command.validateInput(parsedInput, context);
  }
  return parsedInput;
}

export function doesCommandRequireInput(
  command: Pick<RoomCommand, 'inputSchema'>,
): boolean {
  if (!command.inputSchema) {
    return false;
  }
  return !command.inputSchema.safeParse(undefined).success;
}

export function getCommandShortcut(
  command: Pick<RoomCommand, 'ui' | 'shortcut'>,
): string | undefined {
  return command.ui?.shortcut ?? command.shortcut;
}

export function getCommandInputComponent(
  command: Pick<RoomCommand, 'ui' | 'inputComponent'>,
): RoomCommandInputComponent | undefined {
  return command.ui?.inputComponent ?? command.inputComponent;
}

export function resolveCommandPolicyMetadata(
  command: Pick<
    RoomCommand,
    | 'metadata'
    | 'readOnly'
    | 'idempotent'
    | 'riskLevel'
    | 'requiresConfirmation'
  >,
): Required<RoomCommandPolicyMetadata> {
  return {
    readOnly: command.metadata?.readOnly ?? command.readOnly ?? false,
    idempotent: command.metadata?.idempotent ?? command.idempotent ?? false,
    riskLevel: command.metadata?.riskLevel ?? command.riskLevel ?? 'medium',
    requiresConfirmation:
      command.metadata?.requiresConfirmation ??
      command.requiresConfirmation ??
      false,
  };
}

export function exportCommandInputSchema(
  schema: ZodType<unknown> | undefined,
): RoomCommandPortableSchema | undefined {
  if (!schema) {
    return undefined;
  }
  return toPortableSchema(schema);
}

function createCommandDescriptor<RS extends BaseRoomStoreState>(
  command: RegisteredRoomCommand<RS>,
  context: RoomCommandExecutionContext<RS>,
  includeInputSchema: boolean,
): RoomCommandDescriptor {
  const metadata = resolveCommandPolicyMetadata(command);
  return {
    id: command.id,
    owner: command.owner,
    name: command.name,
    description: command.description,
    group: command.group,
    keywords: command.keywords,
    visible: resolveCommandVisibility(command, context),
    enabled: resolveCommandEnabled(command, context),
    requiresInput: doesCommandRequireInput(command),
    inputDescription: command.inputDescription,
    inputSchema: includeInputSchema
      ? exportCommandInputSchema(command.inputSchema)
      : undefined,
    shortcut: getCommandShortcut(command),
    ...metadata,
  };
}

function normalizeCommandExecuteResult(
  commandId: string,
  rawResult: RoomCommandExecuteOutput,
): RoomCommandResult {
  if (isRoomCommandResult(rawResult)) {
    return {
      ...rawResult,
      commandId: rawResult.commandId || commandId,
    };
  }

  return {
    success: true,
    commandId,
    ...(rawResult !== undefined ? {data: rawResult} : {}),
  };
}

function isRoomCommandResult(value: unknown): value is RoomCommandResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    typeof value.success === 'boolean'
  );
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

function normalizeInvocation(
  invocation?: RoomCommandInvocationOptions,
): RoomCommandInvocation {
  return {
    surface: invocation?.surface ?? DEFAULT_COMMAND_SURFACE,
    actor: invocation?.actor,
    traceId: invocation?.traceId,
    metadata: invocation?.metadata,
  };
}

function resolveCommandVisibility<RS extends BaseRoomStoreState>(
  command: RoomCommand<RS>,
  context: RoomCommandExecutionContext<RS>,
): boolean {
  if (command.ui?.hidden) {
    return false;
  }
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

function resolveCommandEnabled<RS extends BaseRoomStoreState>(
  command: RoomCommand<RS>,
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

function parseCommandInput(schema: ZodType<unknown>, input: unknown): unknown {
  const parsedResult = schema.safeParse(input);
  if (parsedResult.success) {
    return parsedResult.data;
  }
  throw new Error(formatCommandInputValidationError(parsedResult.error));
}

function formatCommandInputValidationError(error: z.ZodError): string {
  const message = error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'input';
      return `${path}: ${issue.message}`;
    })
    .join('; ');
  return message.length > 0
    ? `Invalid command input: ${message}`
    : 'Invalid command input.';
}

function toPortableSchema(schema: ZodType<unknown>): RoomCommandPortableSchema {
  const definition = (schema as unknown as {def?: Record<string, unknown>}).def;
  const base: RoomCommandPortableSchema = {
    ...(schema.description ? {description: schema.description} : {}),
  };
  const schemaType = definition?.type;

  if (typeof schemaType !== 'string') {
    return {
      ...base,
      type: 'unknown',
    };
  }

  if (
    schemaType === 'string' ||
    schemaType === 'number' ||
    schemaType === 'boolean' ||
    schemaType === 'bigint' ||
    schemaType === 'date'
  ) {
    return {...base, type: schemaType};
  }

  if (schemaType === 'literal') {
    const literalValues = definition?.values as unknown[] | undefined;
    const literalValue = literalValues?.[0];
    return {
      ...base,
      type:
        typeof literalValue === 'string'
          ? 'string'
          : typeof literalValue === 'number'
            ? 'number'
            : typeof literalValue === 'boolean'
              ? 'boolean'
              : 'unknown',
      const: literalValue,
    };
  }

  if (schemaType === 'enum') {
    const enumEntries = definition?.entries as
      | Record<string, unknown>
      | undefined;
    return {
      ...base,
      type: 'string',
      enum: enumEntries ? Object.values(enumEntries) : [],
    };
  }

  if (schemaType === 'array') {
    const element = definition?.element as ZodType<unknown> | undefined;
    return {
      ...base,
      type: 'array',
      items: element ? toPortableSchema(element) : undefined,
    };
  }

  if (schemaType === 'object') {
    const shapeDefinition = definition?.shape as
      | Record<string, ZodType>
      | (() => Record<string, ZodType>)
      | undefined;
    const shape =
      typeof shapeDefinition === 'function'
        ? shapeDefinition()
        : shapeDefinition;
    const properties: Record<string, RoomCommandPortableSchema> = {};
    const required: string[] = [];
    for (const [key, childSchema] of Object.entries(shape ?? {})) {
      properties[key] = toPortableSchema(childSchema);
      if (!childSchema.isOptional()) {
        required.push(key);
      }
    }
    return {
      ...base,
      type: 'object',
      properties,
      required,
    };
  }

  if (schemaType === 'union') {
    const options =
      (definition?.options as ZodType<unknown>[] | undefined) ?? [];
    return {
      ...base,
      anyOf: options.map((option) => toPortableSchema(option)),
    };
  }

  if (schemaType === 'optional') {
    const innerType = definition?.innerType as ZodType<unknown> | undefined;
    const innerSchema = innerType
      ? toPortableSchema(innerType)
      : {type: 'unknown'};
    return {
      ...base,
      ...innerSchema,
      optional: true,
    };
  }

  if (schemaType === 'nullable') {
    const innerType = definition?.innerType as ZodType<unknown> | undefined;
    const innerSchema = innerType
      ? toPortableSchema(innerType)
      : {type: 'unknown'};
    return {
      ...base,
      ...innerSchema,
      nullable: true,
    };
  }

  if (schemaType === 'default') {
    const innerType = definition?.innerType as ZodType<unknown> | undefined;
    const defaultValue = definition?.defaultValue as unknown;
    const innerSchema = innerType
      ? toPortableSchema(innerType)
      : {type: 'unknown'};
    return {
      ...base,
      ...innerSchema,
      default: resolveDefaultValue(defaultValue),
    };
  }

  return {
    ...base,
    type: schemaType,
  };
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function resolveDefaultValue(defaultValue: unknown): unknown {
  if (typeof defaultValue !== 'function') {
    return defaultValue;
  }

  try {
    return defaultValue();
  } catch {
    return undefined;
  }
}
