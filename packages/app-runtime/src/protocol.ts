import {z} from 'zod';

export const APP_RUNTIME_PROTOCOL_VERSION = 1;
export const APP_RUNTIME_MESSAGE_TYPE = 'sqlrooms.app-runtime.message';

export const AppCapability = z.enum(['query', 'schema', 'initialData']);
export type AppCapability = z.infer<typeof AppCapability>;

export const AppDiagnosticLevel = z.enum(['error', 'warn', 'info']);
export type AppDiagnosticLevel = z.infer<typeof AppDiagnosticLevel>;

export const AppDiagnosticSource = z.enum([
  'runtime',
  'promise',
  'console',
  'resource',
  'query',
  'capability',
  'render',
  'webcontainer',
]);
export type AppDiagnosticSource = z.infer<typeof AppDiagnosticSource>;

export const AppDiagnostic = z.object({
  level: AppDiagnosticLevel,
  source: AppDiagnosticSource,
  message: z.string(),
  file: z.string().optional(),
  line: z.number().optional(),
  column: z.number().optional(),
  stack: z.string().optional(),
  detail: z.unknown().optional(),
  timestamp: z.number().optional(),
});
export type AppDiagnostic = z.infer<typeof AppDiagnostic>;

export const QueryRequest = z.object({
  sql: z.string(),
  params: z.array(z.unknown()).optional(),
  maxRows: z.number().int().positive().optional(),
});
export type QueryRequest = z.infer<typeof QueryRequest>;

export const QueryColumn = z.object({
  name: z.string(),
  type: z.string().optional(),
});
export type QueryColumn = z.infer<typeof QueryColumn>;

export const QueryResult = z.object({
  rows: z.array(z.record(z.string(), z.unknown())),
  columns: z.array(QueryColumn),
  rowCount: z.number().int().nonnegative(),
  truncated: z.boolean().default(false),
  executionMs: z.number().nonnegative().optional(),
});
export type QueryResult = z.infer<typeof QueryResult>;

export const RuntimeErrorCode = z.enum([
  'method_not_found',
  'capability_denied',
  'invalid_request',
  'invalid_select',
  'query_failed',
  'timeout',
  'aborted',
]);
export type RuntimeErrorCode = z.infer<typeof RuntimeErrorCode>;

export const RuntimeErrorPayload = z.object({
  code: RuntimeErrorCode,
  message: z.string(),
  sql: z.string().optional(),
  detail: z.unknown().optional(),
});
export type RuntimeErrorPayload = z.infer<typeof RuntimeErrorPayload>;

export const RuntimeRequestMethod = z.enum(['query', 'schema']);
export type RuntimeRequestMethod = z.infer<typeof RuntimeRequestMethod>;

export const RuntimeRequestMessage = z.object({
  type: z.literal(APP_RUNTIME_MESSAGE_TYPE),
  version: z.literal(APP_RUNTIME_PROTOCOL_VERSION),
  direction: z.literal('request'),
  id: z.string(),
  method: RuntimeRequestMethod,
  payload: z.unknown().optional(),
});
export type RuntimeRequestMessage = z.infer<typeof RuntimeRequestMessage>;

export const RuntimeResponseMessage = z.object({
  type: z.literal(APP_RUNTIME_MESSAGE_TYPE),
  version: z.literal(APP_RUNTIME_PROTOCOL_VERSION),
  direction: z.literal('response'),
  id: z.string(),
  ok: z.boolean(),
  payload: z.unknown().optional(),
  error: RuntimeErrorPayload.optional(),
});
export type RuntimeResponseMessage = z.infer<typeof RuntimeResponseMessage>;

export const RuntimeDiagnosticMessage = z.object({
  type: z.literal(APP_RUNTIME_MESSAGE_TYPE),
  version: z.literal(APP_RUNTIME_PROTOCOL_VERSION),
  direction: z.literal('diagnostic'),
  diagnostic: AppDiagnostic,
});
export type RuntimeDiagnosticMessage = z.infer<typeof RuntimeDiagnosticMessage>;

export const RuntimeMessage = z.discriminatedUnion('direction', [
  RuntimeRequestMessage,
  RuntimeResponseMessage,
  RuntimeDiagnosticMessage,
]);
export type RuntimeMessage = z.infer<typeof RuntimeMessage>;

export function createRuntimeRequest(
  id: string,
  method: RuntimeRequestMethod,
  payload?: unknown,
): RuntimeRequestMessage {
  return {
    type: APP_RUNTIME_MESSAGE_TYPE,
    version: APP_RUNTIME_PROTOCOL_VERSION,
    direction: 'request',
    id,
    method,
    payload,
  };
}

export function createRuntimeResponse(
  id: string,
  payload: unknown,
): RuntimeResponseMessage {
  return {
    type: APP_RUNTIME_MESSAGE_TYPE,
    version: APP_RUNTIME_PROTOCOL_VERSION,
    direction: 'response',
    id,
    ok: true,
    payload,
  };
}

export function createRuntimeErrorResponse(
  id: string,
  error: RuntimeErrorPayload,
): RuntimeResponseMessage {
  return {
    type: APP_RUNTIME_MESSAGE_TYPE,
    version: APP_RUNTIME_PROTOCOL_VERSION,
    direction: 'response',
    id,
    ok: false,
    error,
  };
}

export function createRuntimeDiagnostic(
  diagnostic: AppDiagnostic,
): RuntimeDiagnosticMessage {
  return {
    type: APP_RUNTIME_MESSAGE_TYPE,
    version: APP_RUNTIME_PROTOCOL_VERSION,
    direction: 'diagnostic',
    diagnostic,
  };
}
