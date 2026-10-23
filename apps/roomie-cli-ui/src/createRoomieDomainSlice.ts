import {createArtifactsSlice} from '@sqlrooms/artifacts';
import {createBlockDocumentsSlice} from '@sqlrooms/documents';
import {createHtmlAppRuntimeSlice} from '@sqlrooms/app-runtime';
import {createDashboardFeatureSlices} from '@sqlrooms/mosaic';
import type {StateCreator} from '@sqlrooms/room-store';
import {ensureBlock} from './commands';
import {TableSettings} from './model';
import type {RoomState} from './RoomState';

/** Roomie's content domain. Hosts supply database, lifecycle, and renderers. */
export function createRoomieDomainSlice(
  dashboardOptions: Parameters<typeof createDashboardFeatureSlices>[0] = {},
  includeViewState = true,
): StateCreator<
  RoomState,
  [],
  [],
  Pick<
    RoomState,
    | 'artifacts'
    | 'blockDocuments'
    | 'htmlApps'
    | 'mosaicDashboard'
    | 'blockSettings'
    | 'tableExplorers'
  >
> {
  return (set, get, api) => ({
    ...createArtifactsSlice<RoomState>({
      artifactTypes: {
        'block-document': {
          label: 'Document',
          defaultTitle: 'Untitled document',
          onCreate: ({artifactId}) =>
            get().blockDocuments.ensureBlockDocument(artifactId),
          onDelete: ({artifactId}) =>
            get().blockDocuments.removeBlockDocument(artifactId),
        },
      },
    })(set, get, api),
    ...createBlockDocumentsSlice<RoomState>({
      onCreateOwnedStatefulBlock: ({blockType, blockInstanceId}) =>
        ensureBlock(
          get(),
          blockType,
          blockInstanceId,
          undefined,
          includeViewState,
        ),
      onDeleteOwnedStatefulBlock: ({blockType, blockInstanceId}) => {
        if (blockType === 'dashboard')
          get().mosaicDashboard.removeDashboard(blockInstanceId);
        if (blockType === 'html-app') get().htmlApps.removeApp(blockInstanceId);
        if (blockType === 'data-table')
          set((state) => {
            const byId = {...state.tableExplorers.config.byId};
            delete byId[blockInstanceId];
            return {tableExplorers: {...state.tableExplorers, config: {byId}}};
          });
      },
    })(set, get, api),
    ...createHtmlAppRuntimeSlice()(set, get, api),
    ...createDashboardFeatureSlices(dashboardOptions)(set, get, api),
    tableExplorers: {
      config: {byId: {}},
      update: (id, settings) =>
        set((state) => ({
          tableExplorers: {
            ...state.tableExplorers,
            config: {
              byId: {
                ...state.tableExplorers.config.byId,
                [id]: TableSettings.parse(settings),
              },
            },
          },
        })),
    },
  });
}
