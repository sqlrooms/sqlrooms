/** JSON Schema subset accepted for portable room capability inputs. */
export type JsonSchema = {
  $schema?: string;
  type?: string | string[];
  title?: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema | boolean;
  prefixItems?: JsonSchema[];
  additionalProperties?: boolean | JsonSchema;
  unevaluatedProperties?: boolean | JsonSchema;
  [key: string]: unknown;
};

/** MCP-compatible behavioral hints; hosts must not treat hints as enforcement. */
export type RoomCapabilityAnnotations = {
  readOnlyHint?: boolean;
  idempotentHint?: boolean;
  destructiveHint?: boolean;
  untrustedContentHint?: boolean;
};

/** Host-stamped invocation metadata shared across capability transports. */
export type RoomCapabilityContext = {
  surface: 'mcp-http' | 'ai' | 'cli' | 'api' | (string & {});
  actor?: string;
  traceId?: string;
  requestId?: string;
  clientInfo?: {name?: string; version?: string};
  metadata?: Record<string, unknown>;
  signal?: AbortSignal;
};

/** Successful, JSON-serializable capability result. */
export type RoomCapabilitySuccess = {
  ok: true;
  data?: unknown;
  message?: string;
};

/** Structured capability failure suitable for transport adapters. */
export type RoomCapabilityFailure = {
  ok: false;
  code: string;
  message: string;
  details?: unknown;
  retryable?: boolean;
  inputRequired?: unknown;
};

/** Result returned by every room capability. */
export type RoomCapabilityResult =
  | RoomCapabilitySuccess
  | RoomCapabilityFailure;

/** Executable capability definition owned by a live room. */
export type RoomCapability = {
  name: string;
  title?: string;
  description: string;
  inputSchema: JsonSchema;
  annotations?: RoomCapabilityAnnotations;
  execute: (
    input: unknown,
    context: RoomCapabilityContext,
  ) => Promise<RoomCapabilityResult> | RoomCapabilityResult;
};

/** Serializable catalog representation without the execution function. */
export type RoomCapabilityDescriptor = Omit<RoomCapability, 'execute'>;

/** Result of a pre-execution authorization decision. */
export type RoomCapabilityPolicyDecision =
  | {allowed: true}
  | {allowed: false; result: RoomCapabilityFailure};

/** Optional host policy invoked after validation and before execution. */
export type RoomCapabilityPolicy = {
  authorize?: (options: {
    capability: RoomCapabilityDescriptor;
    input: unknown;
    context: RoomCapabilityContext;
  }) => RoomCapabilityPolicyDecision | Promise<RoomCapabilityPolicyDecision>;
};

/** Bounded invocation record emitted after a capability call completes. */
export type RoomCapabilityTrace = {
  capability: RoomCapabilityDescriptor;
  context: RoomCapabilityContext;
  durationMs: number;
  inputBytes: number;
  outputBytes: number;
  result: RoomCapabilityResult;
};

/** Construction limits and hooks for a room capability runtime. */
export type CreateRoomCapabilityRuntimeOptions = {
  capabilities: RoomCapability[];
  policy?: RoomCapabilityPolicy;
  timeoutMs?: number;
  maxInputBytes?: number;
  maxOutputBytes?: number;
  onInvocation?: (trace: RoomCapabilityTrace) => void | Promise<void>;
};

/** Transport-neutral catalog, invocation, and lifecycle interface. */
export type RoomCapabilityRuntime = {
  listTools: () => RoomCapabilityDescriptor[];
  callTool: (
    name: string,
    input: unknown,
    context: RoomCapabilityContext,
  ) => Promise<RoomCapabilityResult>;
  dispose: () => void;
};
