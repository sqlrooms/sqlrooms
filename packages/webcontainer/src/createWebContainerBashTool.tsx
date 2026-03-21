import {tool} from 'ai';
import z from 'zod';
import type {WebContainerSliceState} from './WebContainerSlice';
import {createWebContainerSandbox} from './WebContainerSandbox';
import type {Sandbox} from './WebContainerSandbox';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WebContainerStoreLike = {
  getState(): WebContainerSliceState;
};

export const WebContainerBashToolParameters = z.object({
  command: z
    .string()
    .describe('The bash command to execute against the project files.'),
});
export type WebContainerBashToolParameters = z.infer<
  typeof WebContainerBashToolParameters
>;

export type WebContainerBashToolOutput = {
  success: boolean;
  details: {
    command: string;
    stdout: string;
    stderr: string;
    exitCode: number;
  };
  errorMessage?: string;
};

export type WebContainerReadFileToolOutput = {
  content: string;
};

export type WebContainerWriteFileToolOutput = {
  success: boolean;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WebContainerToolkitResult = {
  bash: any;
  readFile: any;
  writeFile: any;
  tools: Record<string, any>;
  toolRenderers: Record<string, React.ComponentType<any>>;
};

// ---------------------------------------------------------------------------
// Toolkit factory
// ---------------------------------------------------------------------------

/**
 * Creates a complete set of WebContainer AI tools (bash, readFile, writeFile).
 *
 * Returns synchronous tool objects that can be passed directly to
 * `createAiSlice({ tools })`.  Uses a {@link WebContainerSandbox} adapter
 * so that reads prefer in-memory editor content and writes flow through the
 * editor state for proper UI updates.
 */
export function createWebContainerToolkit(
  store: WebContainerStoreLike,
): WebContainerToolkitResult {
  let sandbox: Sandbox | null = null;

  function getSandbox(): Sandbox {
    if (!sandbox) {
      sandbox = createWebContainerSandbox(() => store.getState());
    }
    return sandbox;
  }

  const bash = tool({
    description:
      'Run bash commands against the WebContainer project files. ' +
      'When searching files (grep, find, etc.), always exclude ' +
      'node_modules, dist, and build directories ' +
      '(e.g. grep --exclude-dir=node_modules, find ... -not -path "*/node_modules/*").',
    inputSchema: WebContainerBashToolParameters,
    execute: async ({command}) => {
      const result = await getSandbox().executeCommand(command);
      return {
        success: result.exitCode === 0,
        details: {
          command,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
        },
        ...(result.exitCode === 0
          ? {}
          : {
              errorMessage:
                result.stderr || `Command exited with code ${result.exitCode}.`,
            }),
      } satisfies WebContainerBashToolOutput;
    },
  });

  const readFile = tool({
    description: 'Read the contents of a file from the project',
    inputSchema: z.object({
      path: z.string().describe('The path to the file to read'),
    }),
    execute: async ({path}) => {
      const content = await getSandbox().readFile(path);
      return {content} satisfies WebContainerReadFileToolOutput;
    },
  });

  const writeFile = tool({
    description:
      'Write content to a file in the project. Creates the file if it does not exist.',
    inputSchema: z.object({
      path: z.string().describe('The path where the file should be written'),
      content: z.string().describe('The content to write to the file'),
    }),
    execute: async ({path, content}) => {
      await getSandbox().writeFiles([{path, content}]);
      return {success: true} satisfies WebContainerWriteFileToolOutput;
    },
  });

  return {
    bash,
    readFile,
    writeFile,
    tools: {bash, readFile, writeFile},
    toolRenderers: {
      bash: WebContainerBashToolResult,
      readFile: WebContainerReadFileToolResult,
      writeFile: WebContainerWriteFileToolResult,
    },
  };
}

// ---------------------------------------------------------------------------
// Backward-compatible single-tool factory
// ---------------------------------------------------------------------------

/**
 * @deprecated Use {@link createWebContainerToolkit} instead for access to
 * bash, readFile, and writeFile tools.
 */
export function createWebContainerBashTool(store: WebContainerStoreLike) {
  return createWebContainerToolkit(store).bash;
}

// ---------------------------------------------------------------------------
// Tool result renderers
// ---------------------------------------------------------------------------

type ToolResultState =
  | 'input-streaming'
  | 'input-available'
  | 'output-available'
  | 'output-error';

type WebContainerBashToolResultProps = {
  input: WebContainerBashToolParameters;
  output: WebContainerBashToolOutput | undefined;
  state: ToolResultState;
  errorText?: string;
};

export function WebContainerBashToolResult({
  input,
  output,
  state,
  errorText,
}: WebContainerBashToolResultProps) {
  const isFinished = state === 'output-available' || state === 'output-error';
  const exitCode = output?.details.exitCode;
  const suffix =
    state === 'output-error'
      ? ` (${errorText || 'failed'})`
      : isFinished && exitCode !== undefined
        ? ` (exit ${exitCode})`
        : '';

  return (
    <div className="text-foreground/50 text-xs">
      Executing bash command <span className="font-mono">{input.command}</span>
      {suffix}
    </div>
  );
}

export const webContainerBashToolRenderer = WebContainerBashToolResult;

type WebContainerReadFileToolResultProps = {
  input: {path: string};
  output: WebContainerReadFileToolOutput | undefined;
  state: ToolResultState;
};

export function WebContainerReadFileToolResult({
  input,
}: WebContainerReadFileToolResultProps) {
  return (
    <div className="text-foreground/50 text-xs">
      Reading file <span className="font-mono">{input.path}</span>
    </div>
  );
}

type WebContainerWriteFileToolResultProps = {
  input: {path: string; content: string};
  output: WebContainerWriteFileToolOutput | undefined;
  state: ToolResultState;
};

export function WebContainerWriteFileToolResult({
  input,
}: WebContainerWriteFileToolResultProps) {
  return (
    <div className="text-foreground/50 text-xs">
      Writing file <span className="font-mono">{input.path}</span>
    </div>
  );
}
