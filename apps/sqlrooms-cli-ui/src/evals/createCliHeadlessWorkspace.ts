import {createNodeDuckDbConnector} from '@sqlrooms/duckdb-node';
import {createStore, type StateCreator} from 'zustand/vanilla';
import {
  createCliDomainSlice,
  type CliDomainState,
} from '../createCliDomainSlice';
import {createCliHeadlessArtifactTypes} from '../createCliDocumentArtifactDefinition';
import {resolveCliCapabilityProfile} from '../profiles';
import {createCliEvalDuckDbOptions} from './fixture';

/** Creates the disposable document/charts/maps domain, without AI or host UI slices. */
export function createCliHeadlessWorkspace() {
  const profile = resolveCliCapabilityProfile({
    profileName: 'document-charts-maps',
  });
  const connector = createNodeDuckDbConnector(createCliEvalDuckDbOptions());
  // CLI command definitions are typed for the full browser state. This profile
  // only exposes commands supported by these domain slices; no fake AI is added.
  const store = createStore<CliDomainState>()(
    createCliDomainSlice({
      profile,
      artifactTypes: createCliHeadlessArtifactTypes(profile),
      shell: {
        connector,
        config: {title: 'SQLRooms isolated evaluation', dataSources: []},
      },
    }) as unknown as StateCreator<CliDomainState>,
  );
  let disposed = false;
  let initialized = false;
  return {
    profile,
    store,
    async initialize() {
      if (disposed) throw new Error('Workspace is disposed.');
      if (initialized) return;
      await store.getState().room.initialize();
      const db = await store.getState().db.getConnector();
      await db.execute('SET enable_external_access = false');
      await store.getState().db.refreshTableSchemas();
      initialized = true;
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      try {
        await store.getState().room.destroy();
      } finally {
        await connector.destroy();
      }
    },
  };
}
