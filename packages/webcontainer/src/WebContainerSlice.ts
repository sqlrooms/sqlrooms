import {
  createSlice,
  StateCreator,
  useBaseRoomStore,
} from '@sqlrooms/room-store';
import {FileSystemTree, WebContainer} from '@webcontainer/api';
import {produce} from 'immer';
import z from 'zod';
import {setFileContentInTree} from './setFileContentInTree';
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

export type WebContainerSliceState = {
  webcontainer: {
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
    initialize: () => Promise<void>;
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
}): StateCreator<WebContainerSliceState> {
  return createSlice<WebContainerSliceState>((set, get) => ({
    webcontainer: {
      config: createDefaultWebContainerSliceConfig(props?.config),
      instance: null,
      output: '',
      capabilities: {},
      commandHistory: [],
      lastCommandStatus: {type: 'idle'},
      serverStatus: {type: 'not-initialized'},
      initialize: async () => {
        if (get().webcontainer.serverStatus.type !== 'not-initialized') {
          return;
        }

        // Reuse cached instance if available (survives HMR)
        const cachedInstance = getCachedWebContainer();
        const cachedUrl = getCachedWebContainerServerUrl();
        if (cachedInstance && cachedUrl) {
          set((state) =>
            produce(state, (draft) => {
              draft.webcontainer.instance = cachedInstance;
              draft.webcontainer.serverStatus = {
                type: 'ready',
                url: cachedUrl,
              };
            }),
          );
          await get().webcontainer.openFile('/src/App.jsx');
          return;
        }

        set((state) =>
          produce(state, (draft) => {
            draft.webcontainer.serverStatus = {type: 'initializing'};
          }),
        );
        const instance = await bootWebContainer();
        await instance.mount(get().webcontainer.config.filesTree);
        set((state) =>
          produce(state, (draft) => {
            draft.webcontainer.instance = instance;
          }),
        );

        const activeFilePath = get().webcontainer.config.activeFilePath;
        if (activeFilePath) {
          await get().webcontainer.openFile(activeFilePath);
        }

        const exitCode = await get().webcontainer.installDependencies();
        if (exitCode !== 0) {
          throw new Error('Installation failed');
        }

        get().webcontainer.startDevServer();
      },

      async installDependencies() {
        const instance = get().webcontainer.instance;
        if (!instance) {
          throw new Error('WebContainer instance not found');
        }
        const cwd = await get().webcontainer.resolveProjectRoot();
        // Install dependencies
        set((state) =>
          produce(state, (draft) => {
            draft.webcontainer.serverStatus = {type: 'install-deps'};
          }),
        );
        for (const manager of ['npm', 'pnpm', 'yarn']) {
          try {
            const installArgs =
              manager === 'yarn' ? ['install'] : ['install', '--no-fund'];
            const installProcess = await instance.spawn(manager, installArgs, {
              cwd,
            });
            installProcess.output.pipeTo(
              new WritableStream({
                write(data) {
                  set((state) => ({
                    webcontainer: {
                      ...state.webcontainer,
                      output: state.webcontainer.output + data,
                    },
                  }));
                },
              }),
            );
            const exitCode = await installProcess.exit;
            if (exitCode === 0) {
              return 0;
            }
          } catch (_e) {
            // Try next package manager.
          }
        }
        return 1;
      },

      async startDevServer() {
        const instance = get().webcontainer.instance;
        if (!instance) {
          throw new Error('WebContainer instance not found');
        }
        const cwd = await get().webcontainer.resolveProjectRoot();
        let started = false;
        // Run `npm run dev` to start the Vite dev server
        for (const manager of ['npm', 'pnpm', 'yarn']) {
          try {
            const args = manager === 'yarn' ? ['dev'] : ['run', 'dev'];
            await instance.spawn(manager, args, {cwd});
            started = true;
            break;
          } catch (_e) {
            // Try next package manager.
          }
        }
        if (!started) {
          throw new Error(
            'Unable to start dev server: no supported package manager found',
          );
        }
        set((state) =>
          produce(state, (draft) => {
            draft.webcontainer.serverStatus = {type: 'starting-dev'};
          }),
        );

        // Wait for `server-ready` event
        instance.on('server-ready', (port, url) => {
          console.log(`Server ready on port ${port} at ${url}`);
          setCachedWebContainerServerUrl(url);
          set((state) =>
            produce(state, (draft) => {
              draft.webcontainer.serverStatus = {type: 'ready', url};
            }),
          );
        });

        instance.on('error', (error) => {
          console.error('Server error', error);
          set((state) =>
            produce(state, (draft) => {
              draft.webcontainer.serverStatus = {type: 'error', error};
            }),
          );
        });
      },

      async resolveProjectRoot() {
        const instance = get().webcontainer.instance;
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
        const existing = state.webcontainer.config.openedFiles.find(
          (f) => f.path === path,
        );
        if (existing) {
          set((s) =>
            produce(s, (draft) => {
              draft.webcontainer.config.activeFilePath = path;
            }),
          );
          return;
        }
        let fileContent = content;
        if (fileContent === undefined) {
          fileContent = await get().webcontainer.getFileContent(path);
        }
        set((s) =>
          produce(s, (draft) => {
            // Guard against async races: the file may have been opened while
            // content was being loaded.
            const alreadyOpen = draft.webcontainer.config.openedFiles.some(
              (f) => f.path === path,
            );
            if (!alreadyOpen) {
              draft.webcontainer.config.openedFiles.push({
                path,
                content: fileContent ?? '',
                dirty: false,
              });
            }
            draft.webcontainer.config.activeFilePath = path;
          }),
        );
      },

      closeFile(path) {
        set((s) =>
          produce(s, (draft) => {
            const wasActive = draft.webcontainer.config.activeFilePath === path;
            draft.webcontainer.config.openedFiles =
              draft.webcontainer.config.openedFiles.filter(
                (f) => f.path !== path,
              );
            if (wasActive) {
              const lastOpened = draft.webcontainer.config.openedFiles.at(-1);
              draft.webcontainer.config.activeFilePath =
                lastOpened?.path ?? null;
            }
          }),
        );
      },

      setActiveFile(path) {
        set((s) =>
          produce(s, (draft) => {
            draft.webcontainer.config.activeFilePath = path;
          }),
        );
      },

      updateFileContent(path, content) {
        set((s) =>
          produce(s, (draft) => {
            const file = draft.webcontainer.config.openedFiles.find(
              (f) => f.path === path,
            );
            if (file) {
              file.content = content;
              file.dirty = true;
            }
            // Keep the in-memory FileSystemTree in sync (immutably)
            draft.webcontainer.config.filesTree = setFileContentInTree(
              draft.webcontainer.config.filesTree,
              path,
              content,
            );
          }),
        );
      },

      hasDirtyFiles() {
        return get().webcontainer.config.openedFiles.some((f) => f.dirty);
      },

      async saveAllOpenFiles() {
        const instance = get().webcontainer.instance;
        if (!instance) {
          throw new Error('WebContainer instance not found');
        }
        const files = get().webcontainer.config.openedFiles;
        for (const f of files) {
          await instance.fs.writeFile(f.path, f.content);
        }
        set((s) =>
          produce(s, (draft) => {
            for (const f of draft.webcontainer.config.openedFiles) {
              f.dirty = false;
            }
          }),
        );
      },

      // Helper to read file content from the WebContainer instance
      // Returns empty string on error or if instance is not available
      async getFileContent(path) {
        const state = get();
        const opened = state.webcontainer.config.openedFiles.find(
          (f) => f.path === path,
        );
        if (opened) return opened.content;
        const instance = state.webcontainer.instance;
        try {
          if (instance) {
            const data = await instance.fs.readFile(path, 'utf-8');
            return typeof data === 'string'
              ? data
              : new TextDecoder().decode(data as Uint8Array);
          }
        } catch (_e) {
          // Swallow and return empty string
        }
        return '';
      },

      async applyFilesTree({filesTree, activeFilePath}) {
        const instance = get().webcontainer.instance;
        const pathExistsInTree = (path: string): boolean => {
          const clean = path.replace(/^\/+/, '');
          if (!clean) return false;
          const parts = clean.split('/').filter(Boolean);
          let cursor: any = filesTree;
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
        };

        const prev = get().webcontainer.config;
        const preservedOpened = prev.openedFiles.filter((f) =>
          pathExistsInTree(f.path),
        );
        const nextActiveFromRequest =
          activeFilePath && pathExistsInTree(activeFilePath)
            ? activeFilePath
            : null;
        const nextActiveFromPrev =
          prev.activeFilePath && pathExistsInTree(prev.activeFilePath)
            ? prev.activeFilePath
            : null;
        const nextActive =
          nextActiveFromRequest ??
          nextActiveFromPrev ??
          preservedOpened[0]?.path ??
          '/src/App.jsx';

        set((s) =>
          produce(s, (draft) => {
            draft.webcontainer.config.filesTree = filesTree;
            draft.webcontainer.config.openedFiles = preservedOpened;
            draft.webcontainer.config.activeFilePath = nextActive;
          }),
        );

        if (instance) {
          await instance.mount(filesTree);
          if (pathExistsInTree(nextActive)) {
            await get().webcontainer.openFile(nextActive);
          }
          return;
        }
      },

      async runCommand(command, args = [], opts) {
        const instance = get().webcontainer.instance;
        if (!instance) {
          throw new Error('WebContainer instance not found');
        }
        const cwd = await get().webcontainer.resolveProjectRoot();

        const startedAt = Date.now();
        let stdout = '';
        const stderr = ''; // TODO: Implement stderr capture
        const captureOutput = opts?.captureOutput !== false;

        set((state) =>
          produce(state, (draft) => {
            draft.webcontainer.lastCommandStatus = {
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
                set((state) => ({
                  webcontainer: {
                    ...state.webcontainer,
                    output: state.webcontainer.output + text,
                  },
                }));
              },
            }),
          );
        }

        const exitCode = await proc.exit;
        const durationMs = Date.now() - startedAt;
        set((state) =>
          produce(state, (draft) => {
            draft.webcontainer.commandHistory.unshift({
              command,
              args,
              startedAt,
              durationMs,
              exitCode,
            });
            draft.webcontainer.commandHistory =
              draft.webcontainer.commandHistory.slice(0, 50);
            draft.webcontainer.lastCommandStatus = {
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
            const result = await get().webcontainer.runCommand(
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
            draft.webcontainer.capabilities = availability;
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
