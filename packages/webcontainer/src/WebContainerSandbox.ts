import type {WebContainerSliceState} from './WebContainerSlice';

/**
 * Minimal sandbox interface for executing commands and managing files
 * in a WebContainer environment.
 */
export interface Sandbox {
  executeCommand(
    command: string,
  ): Promise<{stdout: string; stderr: string; exitCode: number}>;
  readFile(path: string): Promise<string>;
  writeFiles(
    files: Array<{path: string; content: string | Buffer}>,
  ): Promise<void>;
}

/**
 * Adapts the WebContainer slice into the {@link Sandbox} interface.
 *
 * - `readFile` prefers in-memory editor content (dirty files) so the LLM
 *   always sees what the user sees.
 * - `writeFiles` routes through `updateFileContent` + `saveAllOpenFiles` so
 *   changes flow through the editor state and trigger proper UI updates.
 * - `executeCommand` delegates to `executeBashCommand` which handles
 *   `just-bash` lifecycle, terminal output logging, and filesystem sync.
 */
export function createWebContainerSandbox(
  getState: () => WebContainerSliceState,
): Sandbox {
  return {
    async executeCommand(command: string) {
      const result = await getState().webContainer.executeBashCommand(command);
      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      };
    },

    async readFile(path: string) {
      return getState().webContainer.getFileContent(path);
    },

    async writeFiles(files: Array<{path: string; content: string | Buffer}>) {
      const wc = getState().webContainer;
      for (const file of files) {
        const content =
          typeof file.content === 'string'
            ? file.content
            : file.content.toString('utf-8');
        wc.updateFileContent(file.path, content);
      }
      await wc.saveAllOpenFiles();
    },
  };
}
