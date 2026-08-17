export type JsonSchema = {
  type?: string | string[];
  title?: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  additionalProperties?: boolean | JsonSchema;
  [key: string]: unknown;
};

export type RoomCapabilityAnnotations = {
  readOnlyHint?: boolean;
  idempotentHint?: boolean;
  destructiveHint?: boolean;
  untrustedContentHint?: boolean;
};

export type RoomCapabilityContext = {
  surface: 'mcp-http' | 'ai' | 'cli' | 'api' | (string & {});
  actor?: string;
  traceId?: string;
  requestId?: string;
  clientInfo?: {name?: string; version?: string};
  metadata?: Record<string, unknown>;
  signal?: AbortSignal;
};

export type RoomCapabilitySuccess = {
  ok: true;
  data?: unknown;
  message?: string;
};

export type RoomCapabilityFailure = {
  ok: false;
  code: string;
  message: string;
  details?: unknown;
  retryable?: boolean;
  inputRequired?: unknown;
};

export type RoomCapabilityResult =
  | RoomCapabilitySuccess
  | RoomCapabilityFailure;

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

export type RoomCapabilityDescriptor = Omit<RoomCapability, 'execute'>;

export type RoomCapabilityPolicyDecision =
  | {allowed: true}
  | {allowed: false; result: RoomCapabilityFailure};

export type RoomCapabilityPolicy = {
  authorize?: (options: {
    capability: RoomCapabilityDescriptor;
    input: unknown;
    context: RoomCapabilityContext;
  }) => RoomCapabilityPolicyDecision | Promise<RoomCapabilityPolicyDecision>;
};

export type RoomCapabilityTrace = {
  capability: RoomCapabilityDescriptor;
  context: RoomCapabilityContext;
  durationMs: number;
  inputBytes: number;
  outputBytes: number;
  result: RoomCapabilityResult;
};

export type CreateRoomCapabilityRuntimeOptions = {
  capabilities: RoomCapability[];
  policy?: RoomCapabilityPolicy;
  timeoutMs?: number;
  maxInputBytes?: number;
  maxOutputBytes?: number;
  onInvocation?: (trace: RoomCapabilityTrace) => void;
};

export type RoomCapabilityRuntime = {
  listTools: () => RoomCapabilityDescriptor[];
  callTool: (
    name: string,
    input: unknown,
    context: RoomCapabilityContext,
  ) => Promise<RoomCapabilityResult>;
  dispose: () => void;
};
