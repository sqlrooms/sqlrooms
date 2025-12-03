import {createSlice, StateCreator} from '@sqlrooms/room-store';
import {FileSystemTree, WebContainer} from '@webcontainer/api';
import {produce} from 'immer';
import z from 'zod';
import {setFileContentInTree} from './utils/setFileContentInTree';
import {
  bootWebContainer,
  getCachedServerUrl,
  getCachedWebContainer,
  setCachedServerUrl,
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

export function creatDefaultWebContainerSliceConfig(
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
    initialize: () => Promise<void>;
    /**
     * @returns The exit code of the install command
     */
    installDependencies: () => Promise<number>;
    /**
     * @returns The exit code of the start dev server command
     */
    startDevServer: () => Promise<void>;
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
  };
};

export function createWebContainerSlice(props?: {
  config?: Partial<WebContainerSliceConfig>;
}): StateCreator<WebContainerSliceState> {
  {
    return createSlice<WebContainerSliceState>((set, get) => ({
      webContainer: {
        config: creatDefaultWebContainerSliceConfig(props?.config),
        instance: null,
        output: '',
        iframeUrl: undefined,
        serverStatus: {type: 'not-initialized'},
        initialize: async () => {
          if (get().webContainer.serverStatus.type !== 'not-initialized') {
            return;
          }

          // Reuse cached instance if available (survives HMR)
          const cachedInstance = getCachedWebContainer();
          const cachedUrl = getCachedServerUrl();
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
            await get().webContainer.openFile('/src/App.jsx');
            return;
          }

          set((state) =>
            produce(state, (draft) => {
              draft.webContainer.serverStatus = {type: 'initializing'};
            }),
          );
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

          const exitCode = await get().webContainer.installDependencies();
          if (exitCode !== 0) {
            throw new Error('Installation failed');
          }

          get().webContainer.startDevServer();

          // see files.ts in bolt.new
          // const WORK_DIR = '';
          // (instance as any).internal.watchPaths(
          //   {
          //     include: [`${WORK_DIR}/**`],
          //     exclude: ['**/node_modules', '.git'],
          //     includeContent: true,
          //   },
          //   // bufferWatchEvents(100, this.#processEventBuffer.bind(this)),
          //   (event: any) => {
          //     console.log('fs-change', event);
          //   },
          // );
        },

        async installDependencies() {
          const instance = get().webContainer.instance;
          if (!instance) {
            throw new Error('WebContainer instance not found');
          }
          // Install dependencies
          set((state) =>
            produce(state, (draft) => {
              draft.webContainer.serverStatus = {type: 'install-deps'};
            }),
          );
          const installProcess = await instance.spawn('npm', ['install']);
          installProcess.output.pipeTo(
            new WritableStream({
              write(data) {
                set((state) => ({
                  webContainer: {
                    ...state.webContainer,
                    output: state.webContainer.output + data,
                  },
                }));
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
          // Run `npm run dev` to start the Vite dev server
          await instance.spawn('npm', ['run', 'dev']);
          set((state) =>
            produce(state, (draft) => {
              draft.webContainer.serverStatus = {type: 'starting-dev'};
            }),
          );

          // Wait for `server-ready` event
          instance.on('server-ready', (port, url) => {
            console.log(`Server ready on port ${port} at ${url}`);
            setCachedServerUrl(url);
            set((state) =>
              produce(state, (draft) => {
                draft.webContainer.serverStatus = {type: 'ready', url: url};
              }),
            );
          });

          instance.on('error', (error) => {
            console.error('Server error', error);
            set((state) =>
              produce(state, (draft) => {
                draft.webContainer.serverStatus = {type: 'error', error: error};
              }),
            );
          });
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
              draft.webContainer.config.openedFiles.push({
                path,
                content: fileContent ?? '',
                dirty: false,
              });
              draft.webContainer.config.activeFilePath = path;
            }),
          );
        },

        closeFile(path) {
          set((s) =>
            produce(s, (draft) => {
              const wasActive =
                draft.webContainer.config.activeFilePath === path;
              draft.webContainer.config.openedFiles =
                draft.webContainer.config.openedFiles.filter(
                  (f) => f.path !== path,
                );
              if (wasActive) {
                const len = draft.webContainer.config.openedFiles.length;
                draft.webContainer.config.activeFilePath =
                  len > 0
                    ? draft.webContainer.config.openedFiles[len - 1].path
                    : null;
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
              return typeof data === 'string'
                ? data
                : new TextDecoder().decode(data as any);
            }
          } catch (_e) {
            // Swallow and return empty string
          }
          return '';
        },
      },
    }));
  }
}
