import {createArtifactsSlice} from '@sqlrooms/artifacts';
import {createDeckMapsSlice} from '@sqlrooms/deck';
import {createBlockDocumentsSlice} from '@sqlrooms/documents';
import {createRoomShellSlice} from '@sqlrooms/room-shell';
import type {CliLocalFileResolver} from './createCliDataCommands';
import type {StateCreator} from 'zustand';
import type {CliCapabilityProfile} from './profiles';
import {
  registerCliCapabilityProfileCommands,
  unregisterCliCapabilityProfileCommands,
} from './registerCliCapabilityProfileCommands';
import {
  getStatefulBlockArtifactConfig,
  isStatefulBlockArtifactType,
} from './statefulBlockArtifactConfigs';
import type {RoomState} from './store-types';

/** Domain state shared by the browser and both evaluation hosts. No AI session state. */
export type CliDomainState = Pick<
  RoomState,
  | 'room'
  | 'db'
  | 'layout'
  | 'commands'
  | 'artifacts'
  | 'deckMaps'
  | 'blockDocuments'
> & {
  cliCommands: {initialize(): Promise<void>; destroy(): Promise<void>};
};

/**
 * Concrete CLI domain assembly. Hosts inject the connector, artifact renderers,
 * layout and optional command middleware through the existing slice options.
 * Other profile slices (dashboard, Python, etc.) remain browser host adapters.
 */
export function createCliDomainSlice(options: {
  profile: CliCapabilityProfile;
  artifactTypes: RoomState['artifacts']['artifactTypes'];
  shell: Parameters<typeof createRoomShellSlice>[0];
  metaNamespace?: string;
  resolveLocalFile?: CliLocalFileResolver;
}): StateCreator<RoomState, [], [], CliDomainState> {
  return (set, get, store) => ({
    ...createRoomShellSlice(options.shell)(set, get, store),
    ...createArtifactsSlice<RoomState>({artifactTypes: options.artifactTypes})(
      set,
      get,
      store,
    ),
    ...createDeckMapsSlice()(set, get, store),
    ...createBlockDocumentsSlice<RoomState>({
      onCreateOwnedStatefulBlock: ({blockInstanceId, blockType, getState}) => {
        if (!isStatefulBlockArtifactType(blockType)) return;
        // The command has already supplied the title; do not overwrite it.
        getStatefulBlockArtifactConfig(blockType).ensureState(
          getState(),
          blockInstanceId,
        );
      },
      onDeleteOwnedStatefulBlock: ({blockInstanceId, blockType, getState}) => {
        if (!isStatefulBlockArtifactType(blockType)) return;
        getStatefulBlockArtifactConfig(blockType).deleteState(
          getState(),
          blockInstanceId,
        );
      },
    })(set, get, store),
    cliCommands: {
      initialize: async () =>
        registerCliCapabilityProfileCommands(
          store,
          options.profile,
          options.artifactTypes,
          options,
        ),
      destroy: async () => unregisterCliCapabilityProfileCommands(store),
    },
  });
}
