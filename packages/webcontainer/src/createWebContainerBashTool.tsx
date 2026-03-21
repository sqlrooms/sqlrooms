import {tool} from 'ai';
import z from 'zod';
import type {WebContainerSliceState} from './WebContainerSlice';

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
    durationMs: number;
  };
  errorMessage?: string;
};

type WebContainerStoreLike = {
  getState(): WebContainerSliceState;
};

export function createWebContainerBashTool(store: WebContainerStoreLike) {
  return tool({
    description: 'Run bash commands against the WebContainer project files',
    inputSchema: WebContainerBashToolParameters,
    execute: async ({command}) => {
      const result = await store
        .getState()
        .webContainer.executeBashCommand(command);
      return {
        success: result.exitCode === 0,
        details: {
          command,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          durationMs: result.durationMs,
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
}

type WebContainerBashToolResultProps = {
  input: WebContainerBashToolParameters;
  output: WebContainerBashToolOutput | undefined;
  state:
    | 'input-streaming'
    | 'input-available'
    | 'output-available'
    | 'output-error';
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
