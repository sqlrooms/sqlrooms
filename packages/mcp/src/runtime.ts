import Ajv, {type ValidateFunction} from 'ajv';
import type {
  CreateRoomCapabilityRuntimeOptions,
  RoomCapability,
  RoomCapabilityContext,
  RoomCapabilityDescriptor,
  RoomCapabilityFailure,
  RoomCapabilityResult,
  RoomCapabilityRuntime,
} from './types';

const TOOL_NAME_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_INPUT_BYTES = 256 * 1024;
const DEFAULT_MAX_OUTPUT_BYTES = 1024 * 1024;

export function createRoomCapabilityRuntime(
  options: CreateRoomCapabilityRuntimeOptions,
): RoomCapabilityRuntime {
  const capabilities = new Map<string, RoomCapability>();
  const validators = new Map<string, ValidateFunction>();
  const ajv = new Ajv({allErrors: true, strict: false});
  const activeControllers = new Set<AbortController>();
  let disposed = false;

  for (const capability of options.capabilities) {
    if (!TOOL_NAME_PATTERN.test(capability.name)) {
      throw new Error(
        `Invalid room capability name "${capability.name}". Use 1-128 letters, numbers, underscores, or hyphens.`,
      );
    }
    if (capabilities.has(capability.name)) {
      throw new Error(`Duplicate room capability "${capability.name}".`);
    }
    if (capability.inputSchema.type !== 'object') {
      throw new Error(
        `Room capability "${capability.name}" must use an object input schema.`,
      );
    }
    capabilities.set(capability.name, capability);
    validators.set(capability.name, ajv.compile(capability.inputSchema));
  }

  const catalog = Array.from(capabilities.values())
    .sort((first, second) => first.name.localeCompare(second.name))
    .map(toDescriptor);

  return {
    listTools: () => catalog.map(cloneSerializable),
    callTool: async (name, input, context) => {
      if (disposed) {
        return failure(
          'runtime_disposed',
          'The room capability runtime has been disposed.',
          true,
        );
      }
      const capability = capabilities.get(name);
      if (!capability) {
        return failure('tool_not_found', `Unknown room capability "${name}".`);
      }

      const startedAt = Date.now();
      const inputSize = measureJson(input);
      if (!inputSize.ok) return inputSize.result;
      if (
        inputSize.bytes > (options.maxInputBytes ?? DEFAULT_MAX_INPUT_BYTES)
      ) {
        return failure(
          'input_too_large',
          'Capability input exceeds the limit.',
        );
      }

      const validate = validators.get(name)!;
      if (!validate(input)) {
        return failure('invalid_input', 'Capability input is invalid.', false, {
          errors: validate.errors?.map((error) => ({
            path: error.instancePath,
            keyword: error.keyword,
            message: error.message,
          })),
        });
      }

      const controller = new AbortController();
      const abortFromCaller = () => controller.abort(context.signal?.reason);
      context.signal?.addEventListener('abort', abortFromCaller, {once: true});
      activeControllers.add(controller);
      const executionContext = {...context, signal: controller.signal};
      let result: RoomCapabilityResult;
      try {
        const decision = await options.policy?.authorize?.({
          capability: toDescriptor(capability),
          input,
          context: executionContext,
        });
        if (decision && !decision.allowed) {
          result = decision.result;
        } else {
          result = await executeWithTimeout(
            capability,
            input,
            executionContext,
            controller,
            options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
          );
        }
      } catch (error) {
        result = controller.signal.aborted
          ? failure('cancelled', 'Capability execution was cancelled.', true)
          : failure(
              'execution_error',
              error instanceof Error
                ? error.message
                : 'Capability execution failed.',
            );
      } finally {
        activeControllers.delete(controller);
        context.signal?.removeEventListener('abort', abortFromCaller);
      }

      const outputSize = measureJson(result);
      if (!outputSize.ok) result = outputSize.result;
      else if (
        outputSize.bytes > (options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES)
      ) {
        result = failure(
          'output_too_large',
          'Capability output exceeds the limit.',
        );
      }

      const finalOutputSize = measureJson(result);
      options.onInvocation?.({
        capability: toDescriptor(capability),
        context: executionContext,
        durationMs: Date.now() - startedAt,
        inputBytes: inputSize.bytes,
        outputBytes: finalOutputSize.ok ? finalOutputSize.bytes : 0,
        result,
      });
      return cloneSerializable(result);
    },
    dispose: () => {
      disposed = true;
      for (const controller of activeControllers) {
        controller.abort(new Error('Room capability runtime disposed.'));
      }
      activeControllers.clear();
    },
  };
}

async function executeWithTimeout(
  capability: RoomCapability,
  input: unknown,
  context: RoomCapabilityContext,
  controller: AbortController,
  timeoutMs: number,
): Promise<RoomCapabilityResult> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<RoomCapabilityResult>((resolve) => {
    timeout = setTimeout(() => {
      resolve(
        failure('timeout', 'Capability execution timed out.', true, {
          timeoutMs,
        }),
      );
      controller.abort(new Error('Capability execution timed out.'));
    }, timeoutMs);
  });
  const abortPromise = new Promise<RoomCapabilityResult>((resolve) => {
    if (controller.signal.aborted) {
      resolve(
        failure('cancelled', 'Capability execution was cancelled.', true),
      );
      return;
    }
    controller.signal.addEventListener(
      'abort',
      () =>
        resolve(
          failure('cancelled', 'Capability execution was cancelled.', true),
        ),
      {once: true},
    );
  });
  try {
    return await Promise.race([
      Promise.resolve(capability.execute(input, context)),
      timeoutPromise,
      abortPromise,
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function toDescriptor(capability: RoomCapability): RoomCapabilityDescriptor {
  return {
    name: capability.name,
    title: capability.title,
    description: capability.description,
    inputSchema: cloneSerializable(capability.inputSchema),
    annotations: capability.annotations
      ? cloneSerializable(capability.annotations)
      : undefined,
  };
}

function measureJson(
  value: unknown,
): {ok: true; bytes: number} | {ok: false; result: RoomCapabilityFailure} {
  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) {
      return {
        ok: false,
        result: failure(
          'not_serializable',
          'Capability value is not JSON-serializable.',
        ),
      };
    }
    return {ok: true, bytes: new TextEncoder().encode(serialized).byteLength};
  } catch {
    return {
      ok: false,
      result: failure(
        'not_serializable',
        'Capability value is not JSON-serializable.',
      ),
    };
  }
}

function cloneSerializable<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function failure(
  code: string,
  message: string,
  retryable = false,
  details?: unknown,
): RoomCapabilityFailure {
  return {
    ok: false,
    code,
    message,
    ...(details === undefined ? {} : {details}),
    ...(retryable ? {retryable: true} : {}),
  };
}
