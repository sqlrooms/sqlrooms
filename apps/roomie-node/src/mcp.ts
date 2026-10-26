import {
  createRoomCapabilityRuntime,
  type RoomCapability,
  type RoomCapabilityContext,
  type RoomCapabilityPolicy,
  type JsonSchema,
} from '@sqlrooms/mcp';
import {LOCAL_MCP_TOOLS, searchRoomCommands} from '@sqlrooms/mcp/room';
import {z} from 'zod';
import {arrowTableToJson} from '@sqlrooms/duckdb-core';
import type {openWorkspace} from './workspace';

const CommitMetadata = z.object({
  operationId: z.string().min(1).max(200),
  artifactId: z.string().min(1).optional(),
  expectedRevision: z.number().int().nonnegative().optional(),
});
const Input = z.record(z.string(), z.json());

/** Adapt shared commands through the workspace gate; never expose the live store. */
export function createWorkspaceMcpRuntime(
  workspace: Awaited<ReturnType<typeof openWorkspace>>,
  policy?: RoomCapabilityPolicy,
) {
  const capabilities: RoomCapability[] = [
    {
      ...LOCAL_MCP_TOOLS.query,
      description:
        'Run a bounded read of ordinary workspace tables. External reads are denied. Content writes use shared commands and revision checks.',
      execute: async (raw, context) => {
        const {sql, maxRows = 200} = raw as {sql: string; maxRows?: number};
        const table = await workspace.query(
          `SELECT * FROM (${sql.replace(/;\s*$/, '')}) AS roomie_result LIMIT ${maxRows + 1}`,
          context.signal,
        );
        return {
          ok: true,
          data: {
            columns: table.schema.fields.map((field) => ({
              name: field.name,
              type: String(field.type),
            })),
            rows: JSON.parse(
              JSON.stringify(
                arrowTableToJson(table).slice(0, maxRows),
                (_, value) =>
                  typeof value === 'bigint' ? value.toString() : value,
              ),
            ),
            rowCount: Math.min(table.numRows, maxRows),
            maxRows,
            truncated: table.numRows > maxRows,
          },
        };
      },
    },
    {
      ...LOCAL_MCP_TOOLS.search_commands,
      execute: async (raw) => {
        const {query = '', limit = 10} = raw as {
          query?: string;
          limit?: number;
        };
        const commands = searchRoomCommands(
          await workspace.listCommands(),
          query,
          limit,
        );
        return {ok: true, data: {commands}};
      },
    },
    {
      ...LOCAL_MCP_TOOLS.get_command,
      execute: async (raw) => {
        const {commandId} = raw as {commandId: string};
        const command = (await workspace.listCommands()).find(
          (value) => value.id === commandId,
        );
        return command ? {ok: true, data: {command}} : missing(commandId);
      },
    },
    {
      ...LOCAL_MCP_TOOLS.execute_command,
      description:
        'Execute a content command. Writes require commit.operationId; existing documents also require commit.artifactId and commit.expectedRevision. Successful writes include a durable receipt. High-risk or confirmation-gated commands are denied.',
      inputSchema: {
        ...LOCAL_MCP_TOOLS.execute_command.inputSchema,
        properties: {
          ...LOCAL_MCP_TOOLS.execute_command.inputSchema.properties,
          commit: z.toJSONSchema(CommitMetadata) as JsonSchema,
        },
      },
      execute: async (raw, context) => {
        const {
          commandId,
          input = {},
          commit,
        } = raw as {commandId: string; input?: unknown; commit?: unknown};
        const command = (await workspace.listCommands()).find(
          (value) => value.id === commandId,
        );
        if (!command) return missing(commandId);
        if (!command.enabled)
          return {
            ok: false,
            code: 'command-disabled',
            message: 'Command is disabled.',
          };
        if (command.riskLevel === 'high' || command.requiresConfirmation)
          return {
            ok: false,
            code: 'command-confirmation-required',
            message: 'Command requires explicit confirmation.',
          };
        const parsed = Input.safeParse(input);
        if (!parsed.success)
          return {
            ok: false,
            code: 'invalid_input',
            message: 'Command input must be a JSON object.',
          };
        if (command.readOnly) {
          const result = await workspace.read(commandId, parsed.data);
          return result.success
            ? {
                ok: true,
                data: {
                  commandId,
                  code: result.code,
                  data: result.data,
                  revision: result.revision,
                },
              }
            : {
                ok: false,
                code: result.code ?? 'command_failed',
                message: result.error ?? 'Command failed.',
                details: result.data,
              };
        }
        const metadata = CommitMetadata.safeParse(commit);
        if (!metadata.success)
          return {
            ok: false,
            code: 'invalid_input',
            message: 'Writes require valid commit metadata.',
          };
        if (!context.actor)
          return {
            ok: false,
            code: 'unauthorized',
            message: 'Verified owner required.',
          };
        if (context.signal?.aborted) return cancelled();
        const result = await workspace.mutate({
          commandId,
          input: parsed.data,
          principalId: context.actor,
          operationId: metadata.data.operationId,
          artifactId: metadata.data.artifactId,
          expectedRevision: metadata.data.expectedRevision,
        });
        if ('code' in result)
          return {
            ok: false,
            code: result.code,
            message: 'Document revision changed.',
            details: result,
          };
        return {
          ok: true,
          data: {commandId, data: result.result.data, receipt: result},
        };
      },
    },
  ];
  // Track actual executions, even when timeout/disconnect has ended a response.
  const pending = new Set<Promise<unknown>>();
  const runtime = createRoomCapabilityRuntime({
    capabilities: capabilities.map((capability) => ({
      ...capability,
      execute: (input: unknown, context: RoomCapabilityContext) => {
        const work = Promise.resolve()
          .then(() =>
            context.signal?.aborted
              ? cancelled()
              : capability.execute(input, context),
          )
          .catch((error: unknown) => {
            if (
              error instanceof Error &&
              'code' in error &&
              typeof error.code === 'string' &&
              error.code.startsWith('command-')
            )
              return {
                ok: false as const,
                code: error.code,
                message: error.message,
                ...('details' in error ? {details: error.details} : {}),
              };
            throw error;
          });
        pending.add(work);
        void work.finally(() => pending.delete(work)).catch(() => {});
        return work;
      },
    })),
    policy,
  });
  return {
    ...runtime,
    async drain() {
      while (pending.size) await Promise.allSettled([...pending]);
    },
  };
}

function missing(commandId: string) {
  return {
    ok: false as const,
    code: 'command_not_found',
    message: `Unknown command "${commandId}".`,
  };
}

function cancelled() {
  return {
    ok: false as const,
    code: 'cancelled',
    message: 'Execution was cancelled before admission.',
    retryable: true,
  };
}
