import {createSlice, StateCreator} from '@sqlrooms/room-store';
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
  return createSlice<WebContainerSliceState>((set, get) => ({
    webcontainer: {
      config: createDefaultWebContainerSliceConfig(props?.config),
      instance: null,
      output: '',
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
        // Install dependencies
        set((state) =>
          produce(state, (draft) => {
            draft.webcontainer.serverStatus = {type: 'install-deps'};
          }),
        );
        const installProcess = await instance.spawn('npm', ['install']);
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
        // Wait for install command to exit
        return installProcess.exit;
      },

      async startDevServer() {
        const instance = get().webcontainer.instance;
        if (!instance) {
          throw new Error('WebContainer instance not found');
        }
        // Run `npm run dev` to start the Vite dev server
        await instance.spawn('npm', ['run', 'dev']);
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
            draft.webcontainer.config.openedFiles.push({
              path,
              content: fileContent ?? '',
              dirty: false,
            });
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
    },
  }));
}
