import {tool, type Tool} from 'ai';
import {z} from 'zod';
import type {StoreApi} from 'zustand';
import {hasCommandSliceState} from '@sqlrooms/room-shell';
import type {RoomCommand, BaseRoomStoreState} from '@sqlrooms/room-shell';

/**
 * Converts a RoomCommand into an AI Tool.
 *
 * This adapter enables commands to be used directly as LLM tools without
 * requiring execute_command/list_commands indirection.
 *
 * @example Basic usage
 * ```typescript
 * const command = createBlockDocumentCommands()[0];
 * const tool = commandToTool(command, store);
 *
 * // Use in agent
 * const agent = new ToolLoopAgent({
 *   tools: {
 *     'worksheet.create-chart-block': tool,
 *   },
 * });
 * ```
 *
 * @example Batch conversion with filtering
 * ```typescript
 * const commands = createBlockDocumentCommands({
 *   commandNamespace: 'worksheet',
 * });
 *
 * const tools = commandsToTools(
 *   commands.filter(c => c.metadata?.readOnly),
 *   store,
 *   { defaultOptions: { includeMetadataInDescription: true } }
 * );
 * ```
 *
 * @param command The command to convert
 * @param store Store for command execution context
 * @param options Optional configuration for the tool
 */
export function commandToTool<TState extends BaseRoomStoreState>(
  command: RoomCommand<TState>,
  store: StoreApi<TState>,
  options?: CommandToToolOptions,
): Tool {
  // Use command's own inputSchema, or z.unknown() if none
  const inputSchema = command.inputSchema ?? z.unknown();

  // DEBUG: Log command conversion
  console.log('[commandToTool] Converting command:', command.id, 'to tool');

  return tool({
    description: formatToolDescription(command, options),
    inputSchema,
    execute: async (input) => {
      console.log(
        '[commandToTool] Executing command:',
        command.id,
        'with input:',
        JSON.stringify(input).slice(0, 200),
      );
      const state = store.getState();

      // Check if command slice is available
      if (!hasCommandSliceState(state)) {
        return {
          success: false,
          commandId: command.id,
          errorMessage: 'Command registry is not available in this room.',
        };
      }

      // Execute via the command registry to preserve all middleware/hooks
      const result = await state.commands.invokeCommand(command.id, input, {
        surface: 'ai',
        actor: options?.actor,
        traceId: options?.traceId,
        metadata: options?.metadata,
      });

      // Map RoomCommandResult to tool output format
      if (result.success) {
        return {
          success: true,
          commandId: command.id,
          details: `Executed command "${command.id}".`,
          result: {
            code: result.code,
            message: result.message,
            data: result.data,
          },
        };
      }

      return {
        success: false,
        commandId: command.id,
        errorMessage: result.error ?? 'Command execution failed.',
        result: {
          code: result.code,
          message: result.message,
        },
      };
    },
  });
}

/**
 * Options for customizing command-to-tool conversion
 */
export type CommandToToolOptions = {
  /**
   * Actor identifier for command invocation tracking
   */
  actor?: string;

  /**
   * Trace ID for distributed tracing
   */
  traceId?: string;

  /**
   * Additional metadata to attach to command invocation
   */
  metadata?: Record<string, unknown>;

  /**
   * Whether to include command metadata (readOnly, riskLevel) in description
   * @default false
   */
  includeMetadataInDescription?: boolean;

  /**
   * Custom description override (replaces command.description)
   */
  description?: string;
};

/**
 * Formats command description for use as tool description
 */
function formatToolDescription<TState extends BaseRoomStoreState>(
  command: RoomCommand<TState>,
  options?: CommandToToolOptions,
): string {
  if (options?.description) {
    return options.description;
  }

  let description = command.description || command.name;

  if (options?.includeMetadataInDescription && command.metadata) {
    const tags: string[] = [];
    if (command.metadata.readOnly) tags.push('read-only');
    if (command.metadata.idempotent) tags.push('idempotent');
    if (command.metadata.riskLevel)
      tags.push(`risk:${command.metadata.riskLevel}`);
    if (tags.length > 0) {
      description += `\n\nMetadata: ${tags.join(', ')}`;
    }
  }

  return description;
}
