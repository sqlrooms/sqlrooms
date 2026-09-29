import {
  CLI_MCP_TOOLS,
  DEFAULT_QUERY_ROWS,
  MAX_QUERY_ROWS,
} from './cliMcpToolContract';
import type {RoomCapability, RoomCapabilityContext} from '@sqlrooms/mcp';
import {
  arrowTableToJson,
  type DataTable,
  getTableDisplayName,
  getTableIdentity,
  resolveTableReference,
} from '@sqlrooms/duckdb';
import {invokeCommandWithPolicy} from '@sqlrooms/room-shell';
import type {
  RoomCommandDescriptor,
  RoomCommandResult,
} from '@sqlrooms/room-shell';
import {likePatternToRegex} from './mcpCapabilityUtils';
import type {StoreApi} from 'zustand';
import type {RoomShellSliceState} from '@sqlrooms/room-shell';

import {
  assertCliDestination,
  inspectCliSelect,
  needsCliReadApproval,
  CliSqlError,
} from './cliSqlPolicy';

const MAX_LISTED_TABLES = 1_000;
const INTERNAL_SQLROOMS_PREFIX = '__sqlrooms';
const MCP_EXCLUDED_COMMAND_IDS = new Set([
  'room.add-url-data-source',
  'room.add-sql-data-source',
  'sql-editor.run-current-query',
  'sql-editor.run-query',
]);

/** Serializes commands per store, so a replacement runtime waits for work that outlived its predecessor. */
const commandInvocationQueues = new WeakMap<
  StoreApi<RoomShellSliceState>,
  Promise<void>
>();

/** One exact, non-reusable host approval for a SQL read or database write. */
export type CliOperationApproval = {
  kind: 'external-read' | 'write';
  sql: string;
  commandId?: string;
  maxRows?: number;
};

type CreateCliRoomCapabilitiesOptions = {
  approveOperation?: (
    operation: CliOperationApproval,
    context: RoomCapabilityContext,
  ) => Promise<'allow' | 'deny' | 'cancelled' | 'expired'>;
  store: StoreApi<RoomShellSliceState>;
  metaNamespace?: string;
  /** Projects discovery metadata for the host; does not replace authorization. */
  describeCommand?: (command: RoomCommandDescriptor) => RoomCommandDescriptor;
  /** Tracks real commands, which can outlive a cancelled caller. */
  trackPendingOperation?: (operation: Promise<unknown>) => void;
};

/** Creates bounded CLI operations for one injected store and invocation queue. */
export function createCliRoomCapabilities({
  store: roomStore,
  metaNamespace = '__sqlrooms',
  describeCommand,
  trackPendingOperation,
  approveOperation,
}: CreateCliRoomCapabilitiesOptions): RoomCapability[] {
  return [
    createQueryCapability(metaNamespace),
    createListTablesCapability(metaNamespace),
    createReadTableSchemaCapability(metaNamespace),
    createSearchCommandsCapability(),
    createGetCommandCapability(),
    createExecuteCommandCapability(),
  ];

  function createQueryCapability(metaNamespace: string): RoomCapability {
    return {
      ...CLI_MCP_TOOLS.query,
      execute: async (rawInput, context) => {
        const input = rawInput as {sql: string; maxRows?: number};
        const sql = input.sql.trim();
        const maxRows = Math.min(
          MAX_QUERY_ROWS,
          Math.max(1, Math.floor(input.maxRows ?? DEFAULT_QUERY_ROWS)),
        );
        const state = roomStore.getState();
        try {
          const parsed = await inspectCliSelect(state.db, sql, metaNamespace);
          if (await needsCliReadApproval(state.db, parsed)) {
            const denied = await requireApproval(
              {kind: 'external-read', sql, maxRows},
              context,
            );
            if (denied) return denied;
          }
          if (context.signal?.aborted)
            return {ok: false, code: 'cancelled', message: 'Query cancelled.'};
          const connector = await state.db.getConnector();
          const boundedSql = sql.replace(/;+\s*$/, '');
          const result = await connector.query(
            `SELECT * FROM (\n${boundedSql}\n) AS sqlrooms_mcp_query LIMIT ${maxRows + 1}`,
            {signal: context.signal},
          );
          const rows = arrowTableToJson(result);
          const truncated = rows.length > maxRows;
          if (truncated) rows.length = maxRows;
          return {
            ok: true,
            data: {
              rows,
              rowCount: rows.length,
              truncated,
              maxRows,
            },
          };
        } catch (error) {
          return {
            ok: false,
            code:
              error instanceof CliSqlError
                ? error.code
                : context.signal?.aborted
                  ? 'cancelled'
                  : 'query_failed',
            message: error instanceof Error ? error.message : 'Query failed.',
            retryable: Boolean(context.signal?.aborted),
          };
        }
      },
    };
  }

  async function requireApproval(
    operation: CliOperationApproval,
    context: RoomCapabilityContext,
  ) {
    const decision = context.signal?.aborted
      ? 'cancelled'
      : await approveOperation?.(operation, context);
    if (decision === 'allow' && !context.signal?.aborted) return undefined;
    return {
      ok: false,
      code:
        decision === 'cancelled' || context.signal?.aborted
          ? 'cancelled'
          : 'permission_denied',
      message:
        decision === 'expired'
          ? 'Approval expired.'
          : decision === undefined
            ? 'This operation requires approval from the owning browser.'
            : 'The operation was not approved.',
    };
  }

  function createListTablesCapability(metaNamespace: string): RoomCapability {
    return {
      ...CLI_MCP_TOOLS.list_tables,
      execute: async (rawInput) => {
        const input = rawInput as {
          database?: string;
          schema?: string;
          pattern?: string;
          includeViews?: boolean;
        };
        let tables = await refreshVisibleTables(metaNamespace);
        if (input.database) {
          tables = tables.filter(
            (table) => table.table.database === input.database,
          );
        }
        if (input.schema) {
          tables = tables.filter(
            (table) => table.table.schema === input.schema,
          );
        }
        if (input.includeViews === false) {
          tables = tables.filter((table) => !table.isView);
        }
        if (input.pattern) {
          const pattern = likePatternToRegex(input.pattern);
          tables = tables.filter((table) => pattern.test(table.table.table));
        }
        const summaries = tables
          .map((table) => ({
            tableId: getTableIdentity(table.table),
            database: table.table.database,
            schema: table.table.schema,
            tableName: getTableDisplayName(table.table),
            isView: table.isView,
            columnCount: table.columns.length,
            rowCount: table.rowCount,
          }))
          .sort((first, second) => first.tableId.localeCompare(second.tableId));
        const totalCount = summaries.length;
        const boundedSummaries = summaries.slice(0, MAX_LISTED_TABLES);
        return {
          ok: true,
          data: {
            tables: boundedSummaries,
            totalCount,
            truncated: totalCount > boundedSummaries.length,
          },
        };
      },
    };
  }

  function createReadTableSchemaCapability(
    metaNamespace: string,
  ): RoomCapability {
    return {
      ...CLI_MCP_TOOLS.read_table_schema,
      execute: async (rawInput) => {
        const {tableId} = rawInput as {tableId: string};
        const visibleTables = await refreshVisibleTables(metaNamespace);
        const resolution = resolveTableReference(visibleTables, tableId);
        if (resolution.ambiguousMatches) {
          return {
            ok: false,
            code: 'table_ambiguous',
            message: `Table "${tableId}" is ambiguous.`,
            details: {
              matches: resolution.ambiguousMatches.map((table) =>
                getTableIdentity(table.table),
              ),
            },
          };
        }
        const table = resolution.table;
        if (!table) {
          return {
            ok: false,
            code: 'table_not_found',
            message: `Table "${tableId}" was not found.`,
          };
        }
        return {
          ok: true,
          data: {
            table: {
              id: getTableIdentity(table.table),
              name: getTableDisplayName(table.table),
              database: table.table.database,
              schema: table.table.schema,
              isView: table.isView,
              rowCount: table.rowCount,
              columns: table.columns.map((column) => ({
                name: column.name,
                type: column.type,
              })),
              ...(table.sql ? {createStatement: table.sql} : {}),
            },
          },
        };
      },
    };
  }

  async function refreshVisibleTables(
    metaNamespace: string,
  ): Promise<DataTable[]> {
    await roomStore.getState().db.refreshTableSchemas();
    return roomStore.getState().db.tables.filter((table) => {
      const {database, schema, table: tableName} = table.table;
      const identifiers = [database, schema, tableName];
      return (
        !identifiers.some((identifier) =>
          identifier?.startsWith(INTERNAL_SQLROOMS_PREFIX),
        ) &&
        database !== metaNamespace &&
        schema !== metaNamespace
      );
    });
  }

  function createSearchCommandsCapability(): RoomCapability {
    return {
      ...CLI_MCP_TOOLS.search_commands,
      execute: (rawInput, context) => {
        const input = rawInput as {query?: string; limit?: number};
        const query = input.query?.trim().toLowerCase() ?? '';
        const limit = Math.min(50, Math.max(1, input.limit ?? 10));
        const commands = listMcpCommands(context)
          .map((descriptor) => ({
            descriptor,
            score: scoreCommand(descriptor, query),
          }))
          .filter((entry) => !query || entry.score > 0)
          .sort(
            (first, second) =>
              second.score - first.score ||
              first.descriptor.id.localeCompare(second.descriptor.id),
          )
          .slice(0, limit)
          .map(({descriptor, score}) => ({
            id: descriptor.id,
            name: descriptor.name,
            description: descriptor.description,
            group: descriptor.group,
            enabled: descriptor.enabled,
            riskLevel: descriptor.riskLevel,
            requiresConfirmation: descriptor.requiresConfirmation,
            score,
          }));
        return {ok: true, data: {commands}};
      },
    };
  }

  function createGetCommandCapability(): RoomCapability {
    return {
      ...CLI_MCP_TOOLS.get_command,
      execute: (rawInput, context) => {
        const {commandId} = rawInput as {commandId: string};
        const command = listMcpCommands(context, true).find(
          (descriptor) => descriptor.id === commandId,
        );
        return command
          ? {ok: true, data: {command}}
          : {
              ok: false,
              code: 'command_not_found',
              message: `Unknown command "${commandId}".`,
            };
      },
    };
  }

  function createExecuteCommandCapability(): RoomCapability {
    return {
      ...CLI_MCP_TOOLS.execute_command,
      execute: async (rawInput, context) => {
        const {commandId, input} = rawInput as {
          commandId: string;
          input?: unknown;
        };
        const command = listMcpCommands(context).find(
          (descriptor) => descriptor.id === commandId,
        );
        if (!command) {
          return {
            ok: false,
            code: 'command_not_found',
            message: `Unknown command "${commandId}".`,
          };
        }
        const result = await enqueueCommandInvocation(
          commandId,
          async () => {
            const databaseWrite =
              (commandId.startsWith('db.') && !command.readOnly) ||
              commandId === 'room.remove-data-source';
            let confirmed = false;
            if (databaseWrite) {
              const tableName = (input as {tableName?: unknown} | undefined)
                ?.tableName;
              if (typeof tableName === 'string') {
                try {
                  assertCliDestination(
                    roomStore.getState().db,
                    tableName,
                    metaNamespace,
                  );
                } catch (error) {
                  return {
                    success: false,
                    commandId,
                    code:
                      error instanceof CliSqlError
                        ? error.code
                        : 'invalid_table',
                    error: String(error),
                  };
                }
              }
              const denied = await requireApproval(
                {
                  kind: 'write',
                  commandId,
                  sql: JSON.stringify(input ?? {}, null, 2),
                },
                context,
              );
              if (denied)
                return {
                  success: false,
                  commandId,
                  code: denied.code,
                  error: denied.message,
                };
              confirmed = true;
            }
            return invokeCommandWithPolicy(
              roomStore,
              commandId,
              input,
              {
                surface: 'mcp',
                actor: context.actor,
                traceId: context.traceId,
                metadata: {
                  ...(context.metadata ?? {}),
                  mcpRequestId: context.requestId,
                  mcpClientInfo: context.clientInfo,
                },
                signal: context.signal,
              },
              {confirmed},
            );
          },
          context.signal,
        );
        if (result.success) {
          return {
            ok: true,
            message: result.message,
            data: {commandId, code: result.code, data: result.data},
          };
        }
        const confirmationRequired =
          result.code === 'command-confirmation-required';
        return {
          ok: false,
          code: result.code ?? 'command_failed',
          message:
            result.error ?? result.message ?? 'Command execution failed.',
          details: result.data,
          ...(confirmationRequired
            ? {
                inputRequired: {
                  reason: 'confirmation',
                  commandId,
                  message:
                    'This command is excluded from external execution until interoperable confirmation is enabled.',
                },
              }
            : {}),
        };
      },
    };
  }

  function listMcpCommands(
    context: RoomCapabilityContext,
    includeInputSchema = false,
  ) {
    return roomStore
      .getState()
      .commands.listCommands({
        surface: 'mcp',
        actor: context.actor,
        traceId: context.traceId,
        metadata: context.metadata,
        includeInvisible: false,
        includeDisabled: true,
        includeInputSchema,
      })
      .filter((command) => !MCP_EXCLUDED_COMMAND_IDS.has(command.id))
      .map((command) => describeCommand?.(command) ?? command);
  }

  function scoreCommand(command: RoomCommandDescriptor, query: string) {
    if (!query) return 1;
    const terms = query.split(/\s+/).filter(Boolean);
    const id = command.id.toLowerCase();
    const name = command.name.toLowerCase();
    const description = command.description?.toLowerCase() ?? '';
    const keywords = command.keywords?.join(' ').toLowerCase() ?? '';
    return terms.reduce((score, term) => {
      if (id === term) return score + 20;
      if (id.includes(term)) return score + 10;
      if (name.includes(term)) return score + 6;
      if (keywords.includes(term)) return score + 4;
      if (description.includes(term)) return score + 2;
      return score;
    }, 0);
  }

  function cancelledCommandResult(commandId: string): RoomCommandResult {
    return {
      success: false,
      commandId,
      code: 'command-cancelled',
      error: 'Command execution was cancelled.',
    };
  }

  function enqueueCommandInvocation(
    commandId: string,
    invoke: () => Promise<RoomCommandResult>,
    signal?: AbortSignal,
  ): Promise<RoomCommandResult> {
    const waitForTurn =
      commandInvocationQueues.get(roomStore) ?? Promise.resolve();
    let releaseTurn!: () => void;
    const turnFinished = new Promise<void>((resolve) => {
      releaseTurn = resolve;
    });
    commandInvocationQueues.set(
      roomStore,
      waitForTurn.then(() => turnFinished),
    );

    return waitForTurn.then(async () => {
      if (signal?.aborted) {
        releaseTurn();
        return cancelledCommandResult(commandId);
      }

      const invocation = Promise.resolve().then(invoke);
      trackPendingOperation?.(invocation);
      void invocation.then(releaseTurn, releaseTurn);
      if (!signal) {
        return await invocation;
      }

      let onAbort: (() => void) | undefined;
      const aborted = new Promise<RoomCommandResult>((resolve) => {
        onAbort = () => resolve(cancelledCommandResult(commandId));
        signal.addEventListener('abort', onAbort, {once: true});
        if (signal.aborted) {
          onAbort();
        }
      });
      try {
        return await Promise.race([invocation, aborted]);
      } finally {
        if (onAbort) {
          signal.removeEventListener('abort', onAbort);
        }
      }
    });
  }
}
