import {BaseRoomConfig} from '@sqlrooms/room-config';
import {createBaseSlice, StateCreator} from '@sqlrooms/room-store';
import {FileSystemTree, WebContainer} from '@webcontainer/api';
import {produce} from 'immer';

export type WebContainerSliceState = {
  wc: {
    filesTree: FileSystemTree;
    instance: WebContainer | null;
    output: string;
    openedFiles: {path: string; content: string; dirty: boolean}[];
    activeFilePath: string | null;
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

export function createWebContainerSlice(props: {
  filesTree: FileSystemTree;
}): StateCreator<WebContainerSliceState> {
  {
    return createBaseSlice<BaseRoomConfig, WebContainerSliceState>(
      (set, get) => ({
        wc: {
          instance: null,
          output: '',
          filesTree: props.filesTree,
          openedFiles: [],
          activeFilePath: null,
          iframeUrl: undefined,
          serverStatus: {type: 'not-initialized'},
          initialize: async () => {
            if (get().wc.serverStatus.type !== 'not-initialized') {
              return;
            }
            set((state) =>
              produce(state, (draft) => {
                draft.wc.serverStatus = {type: 'initializing'};
              }),
            );
            const instance = await WebContainer.boot();
            await instance.mount(get().wc.filesTree);
            set((state) =>
              produce(state, (draft) => {
                draft.wc.instance = instance;
              }),
            );
            get().wc.openFile('/src/App.jsx');

            const exitCode = await get().wc.installDependencies();
            if (exitCode !== 0) {
              throw new Error('Installation failed');
            }

            get().wc.startDevServer();

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
            const instance = get().wc.instance;
            if (!instance) {
              throw new Error('WebContainer instance not found');
            }
            // Install dependencies
            set((state) =>
              produce(state, (draft) => {
                draft.wc.serverStatus = {type: 'install-deps'};
              }),
            );
            const installProcess = await instance.spawn('npm', ['install']);
            installProcess.output.pipeTo(
              new WritableStream({
                write(data) {
                  set((state) => ({
                    wc: {
                      ...state.wc,
                      output: state.wc.output + data,
                    },
                  }));
                },
              }),
            );
            // Wait for install command to exit
            return installProcess.exit;
          },

          async startDevServer() {
            const instance = get().wc.instance;
            if (!instance) {
              throw new Error('WebContainer instance not found');
            }
            // Run `npm run dev` to start the Vite dev server
            await instance.spawn('npm', ['run', 'dev']);
            set((state) =>
              produce(state, (draft) => {
                draft.wc.serverStatus = {type: 'starting-dev'};
              }),
            );

            // Wait for `server-ready` event
            instance.on('server-ready', (port, url) => {
              console.log(`Server ready on port ${port} at ${url}`);
              set((state) =>
                produce(state, (draft) => {
                  draft.wc.serverStatus = {type: 'ready', url: url};
                }),
              );
            });

            instance.on('error', (error) => {
              console.error('Server error', error);
              set((state) =>
                produce(state, (draft) => {
                  draft.wc.serverStatus = {type: 'error', error: error};
                }),
              );
            });
          },

          async openFile(path, content) {
            const state = get();
            const existing = state.wc.openedFiles.find((f) => f.path === path);
            if (existing) {
              set((s) => ({wc: {...s.wc, activeFilePath: path}}));
              return;
            }
            let fileContent = content;
            if (fileContent === undefined) {
              fileContent = await get().wc.getFileContent(path);
            }
            set((s) =>
              produce(s, (draft) => {
                draft.wc.openedFiles.push({
                  path,
                  content: fileContent ?? '',
                  dirty: false,
                });
                draft.wc.activeFilePath = path;
              }),
            );
          },

          closeFile(path) {
            set((s) =>
              produce(s, (draft) => {
                const wasActive = draft.wc.activeFilePath === path;
                draft.wc.openedFiles = draft.wc.openedFiles.filter(
                  (f) => f.path !== path,
                );
                if (wasActive) {
                  const len = draft.wc.openedFiles.length;
                  draft.wc.activeFilePath =
                    len > 0 ? draft.wc.openedFiles[len - 1].path : null;
                }
              }),
            );
          },

          setActiveFile(path) {
            set((s) => ({wc: {...s.wc, activeFilePath: path}}));
          },

          updateFileContent(path, content) {
            set((s) =>
              produce(s, (draft) => {
                const file = draft.wc.openedFiles.find((f) => f.path === path);
                if (file) {
                  file.content = content;
                  file.dirty = true;
                }
              }),
            );
          },

          hasDirtyFiles() {
            return get().wc.openedFiles.some((f) => f.dirty);
          },

          async saveAllOpenFiles() {
            const instance = get().wc.instance;
            if (!instance) {
              throw new Error('WebContainer instance not found');
            }
            const files = get().wc.openedFiles;
            for (const f of files) {
              await instance.fs.writeFile(f.path, f.content);
            }
            set((s) =>
              produce(s, (draft) => {
                for (const f of draft.wc.openedFiles) {
                  f.dirty = false;
                }
              }),
            );
          },

          // Helper to read file content from the WebContainer instance
          // Returns empty string on error or if instance is not available
          async getFileContent(path) {
            const state = get();
            const opened = state.wc.openedFiles.find((f) => f.path === path);
            if (opened) return opened.content;
            const instance = state.wc.instance;
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
      }),
    );
  }
}
