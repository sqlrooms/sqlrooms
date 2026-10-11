import {
  createSlice,
  StateCreator,
  useBaseRoomStore,
} from '@sqlrooms/room-store';
import {FileSystemTree, WebContainer} from '@webcontainer/api';
import {produce} from 'immer';
import {Bash} from 'just-bash/browser';
import z from 'zod';
import {setFileContentInTree} from './setFileContentInTree';
import {WebContainerFsAdapter} from './WebContainerFsAdapter';
import {
  bootWebContainer,
  getCachedWebContainer,
  getCachedWebContainerServerUrl,
  setCachedWebContainerServerUrl,
} from './webContainerCache';

export const WebContainerSliceConfig = z.object({
  filesTree: z.custom<FileSystemTree>(),
  openedFiles: z.array(
    z.object({
      path: z.string(),
      content: z.string(),
      dirty: z.boolean(),
    }),
  ),
  activeFilePath: z.string().nullable(),
});

/**
 * Persistence-safe schema that strips `filesTree` (which can be huge after
 * `npm install` pulls in `node_modules`) so `JSON.stringify` in the persist
 * middleware never blows up.  The tree is re-exported from the live
 * WebContainer on every boot, so there is nothing to restore.
 */
export const WebContainerPersistConfig = WebContainerSliceConfig.transform(
  ({filesTree: _filesTree, ...rest}) => ({...rest, filesTree: {}}),
);
export type WebContainerSliceConfig = z.infer<typeof WebContainerSliceConfig>;

export function createDefaultWebContainerSliceConfig(
  props?: Partial<WebContainerSliceConfig>,
): WebContainerSliceConfig {
  return {
    filesTree: {},
    openedFiles: [],
    activeFilePath: null,
    ...props,
  };
}

const MAX_COMMAND_OUTPUT_CHARS = 100_000;

function truncateCommandOutput(output: string): string {
  if (output.length <= MAX_COMMAND_OUTPUT_CHARS) return output;
  const half = Math.floor(MAX_COMMAND_OUTPUT_CHARS / 2);
  const omitted = output.length - MAX_COMMAND_OUTPUT_CHARS;
  return `${output.slice(0, half)}\n\n... [${omitted} characters truncated] ...\n\n${output.slice(-half)}`;
}

function isDirectoryEntry(entry: unknown): entry is {
  directory: FileSystemTree;
} {
  return (
    typeof entry === 'object' &&
    entry !== null &&
    'directory' in entry &&
    typeof (entry as {directory?: unknown}).directory === 'object' &&
    (entry as {directory?: unknown}).directory !== null
  );
}

function isFileEntry(entry: unknown): entry is {file: unknown} {
  return typeof entry === 'object' && entry !== null && 'file' in entry;
}

function getFirstFilePathFromTree(
  tree: FileSystemTree,
  currentPath = '',
): string | null {
  for (const [name, entry] of Object.entries(tree)) {
    const nextPath = `${currentPath}/${name}`;
    if (isFileEntry(entry)) {
      return nextPath;
    }
    if (isDirectoryEntry(entry)) {
      const nestedPath = getFirstFilePathFromTree(entry.directory, nextPath);
      if (nestedPath) {
        return nestedPath;
      }
    }
  }
  return null;
}

function pathExistsInTree(tree: FileSystemTree, path: string): boolean {
  const clean = path.replace(/^\/+/, '');
  if (!clean) return false;
  const parts = clean.split('/').filter(Boolean);
  let cursor: any = tree;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    const entry = cursor?.[part];
    if (!entry) return false;
    const isLeaf = i === parts.length - 1;
    if (isLeaf) {
      return Boolean(entry.file);
    }
    if (!entry.directory) return false;
    cursor = entry.directory;
  }
  return false;
}

export type WebContainerSliceState = {
  webContainer: {
    config: WebContainerSliceConfig;
    instance: WebContainer | null;
    output: string;
    serverStatus:
      | {type: 'not-initialized'}
      | {type: 'initializing'}
      | {type: 'starting-dev'}
      | {type: 'install-deps'}
      | {type: 'ready'; url: string}
      | {type: 'error'; error: unknown};
    initialize: (opts?: {force?: boolean}) => Promise<void>;
    /**
     * @returns The exit code of the install command
     */
    installDependencies: () => Promise<number>;
    /**
     * @returns The exit code of the start dev server command
     */
    startDevServer: () => Promise<void>;
    resolveProjectRoot: () => Promise<string>;
    /**
     * Get the most recent content for a file. If the file is open, returns the in-memory
     * (possibly unsaved) content. Otherwise, loads the content from the webcontainer FS.
     */
    getFileContent: (path: string) => Promise<string>;
    executeBashCommand: (command: string) => Promise<{
      exitCode: number;
      stdout: string;
      stderr: string;
      durationMs: number;
    }>;
    openFile: (path: string, content?: string) => Promise<void>;
    closeFile: (path: string) => void;
    setActiveFile: (path: string) => void;
    updateFileContent: (path: string, content: string) => void;
    saveAllOpenFiles: () => Promise<void>;
    hasDirtyFiles: () => boolean;
    applyFilesTree: (args: {
      filesTree: FileSystemTree;
      activeFilePath?: string | null;
    }) => Promise<void>;
    runCommand: (
      command: string,
      args?: string[],
      opts?: {captureOutput?: boolean},
    ) => Promise<{
      exitCode: number;
      stdout: string;
      stderr: string;
      durationMs: number;
    }>;
    probeCapabilities: (
      commands?: string[],
    ) => Promise<Record<string, boolean>>;
    capabilities: Record<string, boolean>;
    commandHistory: Array<{
      command: string;
      args: string[];
      startedAt: number;
      durationMs: number;
      exitCode: number;
    }>;
    lastCommandStatus:
      | {type: 'idle'}
      | {type: 'running'; command: string; args: string[]; startedAt: number}
      | {
          type: 'finished';
          command: string;
          args: string[];
          exitCode: number;
          durationMs: number;
        };
  };
};

export function createWebContainerSlice(props?: {
  config?: Partial<WebContainerSliceConfig>;
  /**
   * Whether room-level slice initialization should eagerly boot WebContainer.
   * Disable this when runtime startup should happen only on explicit user action.
   */
  autoInitialize?: boolean;
}): StateCreator<WebContainerSliceState> {
  let bashRuntime:
    | {
        owner: WebContainer;
        adapter: WebContainerFsAdapter;
        bash: Bash;
      }
    | undefined;

  const syncSliceConfigFromWebContainer = async (
    get: () => WebContainerSliceState,
    set: (
      partial:
        | WebContainerSliceState
        | Partial<WebContainerSliceState>
        | ((
            state: WebContainerSliceState,
          ) => WebContainerSliceState | Partial<WebContainerSliceState>),
      replace?: false,
    ) => void,
  ) => {
    const instance = get().webContainer.instance;
    if (!instance) {
      return;
    }

    const filesTree = await instance.export('.', {
      excludes: ['**/node_modules/**'],
    });
    const prevConfig = get().webContainer.config;
    const openedFiles = await Promise.all(
      prevConfig.openedFiles
        .filter((file) => pathExistsInTree(filesTree, file.path))
        .map(async (file) => {
          try {
            const content = await instance.fs.readFile(file.path, 'utf-8');
            return {
              path: file.path,
              content,
              dirty: false,
            };
          } catch (_error) {
            return {
              path: file.path,
              content: file.content,
              dirty: false,
            };
          }
        }),
    );

    const nextActive =
      prevConfig.activeFilePath &&
      pathExistsInTree(filesTree, prevConfig.activeFilePath)
        ? prevConfig.activeFilePath
        : (openedFiles.at(-1)?.path ?? getFirstFilePathFromTree(filesTree));

    set((state) =>
      produce(state, (draft) => {
        draft.webContainer.config.filesTree = filesTree;
        draft.webContainer.config.openedFiles = openedFiles;
        draft.webContainer.config.activeFilePath = nextActive;
      }),
    );
  };

  const getOrCreateBashRuntime = async (
    get: () => WebContainerSliceState,
  ): Promise<{
    owner: WebContainer;
    adapter: WebContainerFsAdapter;
    bash: Bash;
  }> => {
    const instance = get().webContainer.instance;
    if (!instance) {
      throw new Error('WebContainer instance not found');
    }

    if (!bashRuntime || bashRuntime.owner !== instance) {
      const adapter = new WebContainerFsAdapter(instance);
      bashRuntime = {
        owner: instance,
        adapter,
        bash: new Bash({
          cwd: '/',
          fs: adapter.asFileSystem(),
        }),
      };
    }

    await bashRuntime.adapter.syncFromWebContainer();
    return bashRuntime;
  };

  return createSlice<WebContainerSliceState>((set, get) => ({
    webContainer: {
      config: createDefaultWebContainerSliceConfig(props?.config),
      instance: null,
      output: '',
      capabilities: {},
      commandHistory: [],
      lastCommandStatus: {type: 'idle'},
      serverStatus: {type: 'not-initialized'},
      initialize: async (opts) => {
        if (!opts?.force && props?.autoInitialize === false) {
          return;
        }
        if (get().webContainer.serverStatus.type !== 'not-initialized') {
          return;
        }

        // Reuse cached instance if available (survives HMR)
        const cachedInstance = getCachedWebContainer();
        const cachedUrl = getCachedWebContainerServerUrl();
        if (cachedInstance && cachedUrl) {
          set((state) =>
            produce(state, (draft) => {
              draft.webContainer.instance = cachedInstance;
              draft.webContainer.serverStatus = {
                type: 'ready',
                url: cachedUrl,
              };
            }),
          );
          const state = get().webContainer.config;
          const filePathToOpen =
            state.activeFilePath ?? getFirstFilePathFromTree(state.filesTree);
          if (filePathToOpen) {
            await get().webContainer.openFile(filePathToOpen);
          }
          return;
        }

        set((state) =>
          produce(state, (draft) => {
            draft.webContainer.serverStatus = {type: 'initializing'};
          }),
        );
        try {
          const instance = await bootWebContainer();
          await instance.mount(get().webContainer.config.filesTree);
          set((state) =>
            produce(state, (draft) => {
              draft.webContainer.instance = instance;
            }),
          );

          const activeFilePath = get().webContainer.config.activeFilePath;
          if (activeFilePath) {
            await get().webContainer.openFile(activeFilePath);
          }
        } catch (error) {
          set((state) =>
            produce(state, (draft) => {
              draft.webContainer.instance = null;
              draft.webContainer.serverStatus = {type: 'error', error};
            }),
          );
          throw new Error(
            `WebContainer initialization failed during boot/mount: ${String(error)}`,
          );
        }

        try {
          const exitCode = await get().webContainer.installDependencies();
          if (exitCode !== 0) {
            throw new Error('Installation failed');
          }
        } catch (error) {
          set((state) =>
            produce(state, (draft) => {
              draft.webContainer.serverStatus = {type: 'error', error};
            }),
          );
          throw new Error(
            `WebContainer initialization failed during dependency installation: ${String(error)}`,
          );
        }

        try {
          await get().webContainer.startDevServer();
        } catch (error) {
          set((state) =>
            produce(state, (draft) => {
              draft.webContainer.serverStatus = {type: 'error', error};
            }),
          );
          throw new Error(
            `WebContainer initialization failed while starting dev server: ${String(error)}`,
          );
        }
      },

      async installDependencies() {
        const instance = get().webContainer.instance;
        if (!instance) {
          throw new Error('WebContainer instance not found');
        }
        const cwd = await get().webContainer.resolveProjectRoot();
        // Install dependencies
        set((state) =>
          produce(state, (draft) => {
            draft.webContainer.serverStatus = {type: 'install-deps'};
          }),
        );
        const installProcess = await instance.spawn('npm', ['install'], {cwd});
        installProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              set((state) =>
                produce(state, (draft) => {
                  draft.webContainer.output += data;
                }),
              );
            },
          }),
        );
        // Wait for install command to exit
        return installProcess.exit;
      },

      async startDevServer() {
        const instance = get().webContainer.instance;
        if (!instance) {
          throw new Error('WebContainer instance not found');
        }
        const cwd = await get().webContainer.resolveProjectRoot();
        let started = false;
        let devProcess: {exit: Promise<number>} | null = null;
        // Run `npm run dev` to start the Vite dev server
        for (const manager of ['npm', 'pnpm', 'yarn']) {
          try {
            const args = manager === 'yarn' ? ['dev'] : ['run', 'dev'];
            const process = await instance.spawn(manager, args, {cwd});
            devProcess = process;
            started = true;
            break;
          } catch (_e) {
            // Try next package manager.
          }
        }
        if (!started || !devProcess) {
          throw new Error(
            'Unable to start dev server: no supported package manager found',
          );
        }
        set((state) =>
          produce(state, (draft) => {
            draft.webContainer.serverStatus = {type: 'starting-dev'};
          }),
        );
        return new Promise<void>((resolve, reject) => {
          let settled = false;
          let offReady: (() => void) | undefined = undefined;
          let offError: (() => void) | undefined = undefined;
          const cleanup = () => {
            offReady?.();
            offError?.();
          };
          offReady = instance.on('server-ready', (_port, url) => {
            if (settled) return;
            settled = true;
            cleanup();
            setCachedWebContainerServerUrl(url);
            set((state) =>
              produce(state, (draft) => {
                draft.webContainer.serverStatus = {type: 'ready', url};
              }),
            );
            resolve();
          });
          offError = instance.on('error', (error) => {
            if (settled) return;
            settled = true;
            cleanup();
            set((state) =>
              produce(state, (draft) => {
                draft.webContainer.serverStatus = {type: 'error', error};
              }),
            );
            reject(error);
          });
          void devProcess.exit
            .then((exitCode) => {
              if (settled) return;
              settled = true;
              cleanup();
              const error = new Error(
                `Dev server process exited before ready (code ${exitCode})`,
              );
              set((state) =>
                produce(state, (draft) => {
                  draft.webContainer.serverStatus = {type: 'error', error};
                }),
              );
              reject(error);
            })
            .catch((error) => {
              if (settled) return;
              settled = true;
              cleanup();
              set((state) =>
                produce(state, (draft) => {
                  draft.webContainer.serverStatus = {type: 'error', error};
                }),
              );
              reject(error);
            });
        });
      },

      async resolveProjectRoot() {
        const instance = get().webContainer.instance;
        if (!instance) {
          throw new Error('WebContainer instance not found');
        }
        const candidates = ['/', '/project', '/workspace', '/app'];
        for (const dir of candidates) {
          try {
            await instance.fs.readFile(`${dir}/package.json`, 'utf-8');
            return dir;
          } catch (_e) {
            // keep checking candidates
          }
        }
        throw new Error(
          'package.json not found in mounted WebContainer filesystem',
        );
      },

      async openFile(path, content) {
        const state = get();
        const existing = state.webContainer.config.openedFiles.find(
          (f) => f.path === path,
        );
        if (existing) {
          set((s) =>
            produce(s, (draft) => {
              draft.webContainer.config.activeFilePath = path;
            }),
          );
          return;
        }
        let fileContent = content;
        if (fileContent === undefined) {
          fileContent = await get().webContainer.getFileContent(path);
        }
        set((s) =>
          produce(s, (draft) => {
            // Guard against async races: the file may have been opened while
            // content was being loaded.
            const alreadyOpen = draft.webContainer.config.openedFiles.some(
              (f) => f.path === path,
            );
            if (!alreadyOpen) {
              draft.webContainer.config.openedFiles.push({
                path,
                content: fileContent ?? '',
                dirty: false,
              });
            }
            draft.webContainer.config.activeFilePath = path;
          }),
        );
      },

      closeFile(path) {
        set((s) =>
          produce(s, (draft) => {
            const wasActive = draft.webContainer.config.activeFilePath === path;
            draft.webContainer.config.openedFiles =
              draft.webContainer.config.openedFiles.filter(
                (f) => f.path !== path,
              );
            if (wasActive) {
              const lastOpened = draft.webContainer.config.openedFiles.at(-1);
              draft.webContainer.config.activeFilePath =
                lastOpened?.path ?? null;
            }
          }),
        );
      },

      setActiveFile(path) {
        set((s) =>
          produce(s, (draft) => {
            draft.webContainer.config.activeFilePath = path;
          }),
        );
      },

      updateFileContent(path, content) {
        set((s) =>
          produce(s, (draft) => {
            const file = draft.webContainer.config.openedFiles.find(
              (f) => f.path === path,
            );
            if (file) {
              file.content = content;
              file.dirty = true;
            }
            // Keep the in-memory FileSystemTree in sync (immutably)
            draft.webContainer.config.filesTree = setFileContentInTree(
              draft.webContainer.config.filesTree,
              path,
              content,
            );
          }),
        );
      },

      hasDirtyFiles() {
        return get().webContainer.config.openedFiles.some((f) => f.dirty);
      },

      async saveAllOpenFiles() {
        const instance = get().webContainer.instance;
        if (!instance) {
          throw new Error('WebContainer instance not found');
        }
        const files = get().webContainer.config.openedFiles;
        for (const f of files) {
          await instance.fs.writeFile(f.path, f.content);
        }
        set((s) =>
          produce(s, (draft) => {
            for (const f of draft.webContainer.config.openedFiles) {
              f.dirty = false;
            }
          }),
        );
      },

      // Helper to read file content from the WebContainer instance
      // Returns empty string on error or if instance is not available
      async getFileContent(path) {
        const state = get();
        const opened = state.webContainer.config.openedFiles.find(
          (f) => f.path === path,
        );
        if (opened) return opened.content;
        const instance = state.webContainer.instance;
        try {
          if (instance) {
            const data = await instance.fs.readFile(path, 'utf-8');
            return data;
          }
        } catch (_e) {
          // Swallow and return empty string
        }
        return '';
      },

      async executeBashCommand(command) {
        const instance = get().webContainer.instance;
        if (!instance) {
          throw new Error('WebContainer instance not found');
        }

        await get().webContainer.saveAllOpenFiles();
        const {bash} = await getOrCreateBashRuntime(get);

        const startedAt = Date.now();
        set((state) =>
          produce(state, (draft) => {
            draft.webContainer.output += `$ ${command}\n`;
          }),
        );

        try {
          const result = await bash.exec(command, {cwd: '/'});
          const durationMs = Date.now() - startedAt;
          const combinedOutput = `${result.stdout}${result.stderr}`;

          if (combinedOutput) {
            set((state) =>
              produce(state, (draft) => {
                const truncated = truncateCommandOutput(combinedOutput);
                draft.webContainer.output += truncated.endsWith('\n')
                  ? truncated
                  : `${truncated}\n`;
              }),
            );
          }

          await syncSliceConfigFromWebContainer(get, set);
          return {
            exitCode: result.exitCode,
            stdout: truncateCommandOutput(result.stdout),
            stderr: truncateCommandOutput(result.stderr),
            durationMs,
          };
        } catch (error) {
          const durationMs = Date.now() - startedAt;
          const message =
            error instanceof Error
              ? error.message
              : String(error ?? 'Unknown error');

          set((state) =>
            produce(state, (draft) => {
              draft.webContainer.output += message.endsWith('\n')
                ? message
                : `${message}\n`;
            }),
          );

          await syncSliceConfigFromWebContainer(get, set);
          return {
            exitCode: 1,
            stdout: '',
            stderr: message,
            durationMs,
          };
        }
      },

      async applyFilesTree({filesTree, activeFilePath}) {
        const instance = get().webContainer.instance;
        const prev = get().webContainer.config;
        const preservedOpened = prev.openedFiles.filter((f) =>
          pathExistsInTree(filesTree, f.path),
        );
        const nextActiveFromRequest =
          activeFilePath && pathExistsInTree(filesTree, activeFilePath)
            ? activeFilePath
            : null;
        const nextActiveFromPrev =
          prev.activeFilePath &&
          pathExistsInTree(filesTree, prev.activeFilePath)
            ? prev.activeFilePath
            : null;
        const nextActive =
          nextActiveFromRequest ??
          nextActiveFromPrev ??
          preservedOpened[0]?.path ??
          getFirstFilePathFromTree(filesTree);

        set((s) =>
          produce(s, (draft) => {
            draft.webContainer.config.filesTree = filesTree;
            draft.webContainer.config.openedFiles = preservedOpened;
            draft.webContainer.config.activeFilePath = nextActive;
          }),
        );

        if (instance) {
          await instance.mount(filesTree);
          if (nextActive && pathExistsInTree(filesTree, nextActive)) {
            await get().webContainer.openFile(nextActive);
          }
          return;
        }
      },

      /**
       * Execute a command in the resolved project root.
       *
       * Note: WebContainer process output is currently treated as a single merged stream,
       * so `stderr` is not captured separately and is returned as an empty string.
       */
      async runCommand(command, args = [], opts) {
        const instance = get().webContainer.instance;
        if (!instance) {
          throw new Error('WebContainer instance not found');
        }
        const cwd = await get().webContainer.resolveProjectRoot();

        const startedAt = Date.now();
        let stdout = '';
        const stderr = '';
        const captureOutput = opts?.captureOutput !== false;

        set((state) =>
          produce(state, (draft) => {
            draft.webContainer.lastCommandStatus = {
              type: 'running',
              command,
              args,
              startedAt,
            };
          }),
        );

        const proc = await instance.spawn(command, args, {cwd});
        if (captureOutput) {
          await proc.output.pipeTo(
            new WritableStream({
              write(data) {
                const text = String(data ?? '');
                stdout += text;
                set((state) =>
                  produce(state, (draft) => {
                    draft.webContainer.output += text;
                  }),
                );
              },
            }),
          );
        }

        const exitCode = await proc.exit;
        const durationMs = Date.now() - startedAt;
        set((state) =>
          produce(state, (draft) => {
            draft.webContainer.commandHistory.unshift({
              command,
              args,
              startedAt,
              durationMs,
              exitCode,
            });
            draft.webContainer.commandHistory =
              draft.webContainer.commandHistory.slice(0, 50);
            draft.webContainer.lastCommandStatus = {
              type: 'finished',
              command,
              args,
              exitCode,
              durationMs,
            };
          }),
        );
        return {exitCode, stdout, stderr, durationMs};
      },

      async probeCapabilities(
        commands = ['node', 'npm', 'pnpm', 'yarn', 'npx', 'jq', 'grep'],
      ) {
        const availability: Record<string, boolean> = {};
        for (const cmd of commands) {
          try {
            const result = await get().webContainer.runCommand(
              cmd,
              ['--version'],
              {
                captureOutput: false,
              },
            );
            availability[cmd] = result.exitCode === 0;
          } catch (_e) {
            availability[cmd] = false;
          }
        }
        set((state) =>
          produce(state, (draft) => {
            draft.webContainer.capabilities = availability;
          }),
        );
        return availability;
      },
    },
  }));
}

export function useStoreWithWebContainer<T>(
  selector: (state: WebContainerSliceState) => T,
): T {
  return useBaseRoomStore<WebContainerSliceState, T>((state) =>
    selector(state),
  );
}
