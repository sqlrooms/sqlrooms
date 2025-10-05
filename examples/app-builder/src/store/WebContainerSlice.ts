import {BaseRoomConfig} from '@sqlrooms/room-config';
import {createBaseSlice, StateCreator} from '@sqlrooms/room-store';
import {FileSystemTree, WebContainer} from '@webcontainer/api';
import {produce} from 'immer';

export type WebContainerSliceState = {
  wc: {
    filesTree: FileSystemTree;
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
          iframeUrl: undefined,
          serverStatus: {type: 'not-initialized'},
          initialize: async () => {
            console.log('WebContainerSlice initialize');
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
        },
      }),
    );
  }
}
