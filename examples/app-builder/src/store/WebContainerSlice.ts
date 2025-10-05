import {BaseRoomConfig} from '@sqlrooms/room-config';
import {createBaseSlice, StateCreator} from '@sqlrooms/room-store';
import {FileSystemTree, WebContainer} from '@webcontainer/api';
import {produce} from 'immer';
import {editableFileContents, editableFilePath} from './initialFilesTree';

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
    writeEditableFile: (content: string) => Promise<void>;
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
          openedFiles: [
            {
              path: editableFilePath,
              content: editableFileContents,
              dirty: false,
            },
          ],
          activeFilePath: editableFilePath,
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

            const exitCode = await get().wc.installDependencies();
            if (exitCode !== 0) {
              throw new Error('Installation failed');
            }

            get().wc.startDevServer();
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

          async writeEditableFile(content) {
            const instance = get().wc.instance;
            if (!instance) {
              throw new Error('WebContainer instance not found');
            }
            await instance.fs.writeFile(editableFilePath, content);
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
              try {
                const instance = state.wc.instance;
                if (instance) {
                  const data = await instance.fs.readFile(path, 'utf-8');
                  fileContent =
                    typeof data === 'string'
                      ? data
                      : new TextDecoder().decode(data as any);
                }
              } catch (e) {
                fileContent = '';
              }
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
        },
      }),
    );
  }
}
