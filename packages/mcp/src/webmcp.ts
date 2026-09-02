import type {
  JsonSchema,
  RoomCapabilityAnnotations,
  RoomCapabilityContext,
  RoomCapabilityResult,
  RoomCapabilityRuntime,
} from './types';

type WebMcpExecuteOptions = {signal?: AbortSignal};

type WebMcpTool = {
  name: string;
  title?: string;
  description: string;
  inputSchema: JsonSchema;
  annotations?: RoomCapabilityAnnotations;
  execute: (
    input: unknown,
    options?: WebMcpExecuteOptions,
  ) => Promise<RoomCapabilityResult>;
};

/** Minimal current WebMCP imperative API used by the adapter. */
export type WebMcpModelContext = {
  registerTool: (
    tool: WebMcpTool,
    options?: {signal?: AbortSignal; exposedTo?: string[]},
  ) => void | Promise<void>;
};

/** Options for registering one room capability runtime with WebMCP. */
export type RegisterWebMcpToolsOptions = {
  /** Overrides `document.modelContext`, primarily for host adapters and tests. */
  modelContext?: WebMcpModelContext;
  actor?: string;
  metadata?: Record<string, unknown>;
  /** Trusted secure origins allowed to discover the tools across frames. */
  exposedTo?: string[];
};

/** Lifecycle handle for a progressively enhanced WebMCP registration. */
export type WebMcpToolRegistration = {
  supported: boolean;
  registeredTools: string[];
  dispose: () => void;
};

/**
 * Registers every capability in a live room runtime as a WebMCP imperative
 * tool. Unsupported browsers receive a no-op registration so the application
 * remains fully functional without WebMCP.
 *
 * Disposing the handle aborts the registration signal, which unregisters the
 * tools according to the current WebMCP lifecycle contract. The room runtime
 * remains owned by its host and is not disposed by this adapter.
 */
export async function registerWebMcpTools(
  runtime: RoomCapabilityRuntime,
  options: RegisterWebMcpToolsOptions = {},
): Promise<WebMcpToolRegistration> {
  const modelContext = options.modelContext ?? getDocumentModelContext();
  if (!modelContext) {
    return {supported: false, registeredTools: [], dispose: () => undefined};
  }

  const registrationController = new AbortController();
  const registeredTools: string[] = [];
  try {
    for (const capability of runtime.listTools()) {
      await modelContext.registerTool(
        {
          name: capability.name,
          title: capability.title,
          description: capability.description,
          inputSchema: capability.inputSchema,
          annotations: capability.annotations,
          execute: async (input, executionOptions) => {
            const requestId = createRequestId();
            const context: RoomCapabilityContext = {
              surface: 'webmcp',
              actor: options.actor,
              traceId: requestId,
              requestId,
              metadata: {
                ...(options.metadata ?? {}),
                webmcpToolName: capability.name,
              },
              signal: executionOptions?.signal,
            };
            return runtime.callTool(capability.name, input ?? {}, context);
          },
        },
        {
          signal: registrationController.signal,
          ...(options.exposedTo ? {exposedTo: [...options.exposedTo]} : {}),
        },
      );
      registeredTools.push(capability.name);
    }
  } catch (error) {
    registrationController.abort();
    throw error;
  }

  return {
    supported: true,
    registeredTools,
    dispose: () => registrationController.abort(),
  };
}

function getDocumentModelContext(): WebMcpModelContext | undefined {
  if (typeof document === 'undefined') return undefined;
  const candidate = (document as Document & {modelContext?: unknown})
    .modelContext;
  if (!candidate || typeof candidate !== 'object') return undefined;
  const registerTool = (candidate as {registerTool?: unknown}).registerTool;
  return typeof registerTool === 'function'
    ? (candidate as WebMcpModelContext)
    : undefined;
}

function createRequestId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `webmcp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
