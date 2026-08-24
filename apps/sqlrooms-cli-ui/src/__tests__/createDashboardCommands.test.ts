import {
  createArtifactsSlice,
  defineArtifactTypes,
  type ArtifactsSliceState,
} from '@sqlrooms/artifacts';
import {
  createBaseRoomSlice,
  type BaseRoomStoreState,
} from '@sqlrooms/room-store';
import {createStore} from 'zustand';
import {CLI_ARTIFACT_TYPES, type CliArtifactType} from '../artifactTypeIds';
import {createDashboardCommands} from '../createDashboardCommands';

type TestRoomState = BaseRoomStoreState & ArtifactsSliceState;

function createCommandContext(getState: () => unknown) {
  return {
    getState: () => getState() as any,
    store: {getState} as any,
    invocation: {surface: 'unknown' as const},
  };
}

function createArtifactStore(events: string[] = []) {
  const artifactTypes = defineArtifactTypes({
    document: {
      label: 'Document',
      defaultTitle: 'Document',
      onRename: ({artifactId, previousTitle, artifact}) => {
        events.push(`rename:${artifactId}:${previousTitle}:${artifact.title}`);
      },
    },
  });

  return createStore<TestRoomState>()((...args) => ({
    ...createBaseRoomSlice()(...args),
    ...createArtifactsSlice({artifactTypes})(...args),
  }));
}

function getCommand(id: string) {
  const command = createDashboardCommands().find(
    (candidate) => candidate.id === id,
  );
  if (!command) {
    throw new Error(`Missing command "${id}".`);
  }
  return command;
}

describe('createDashboardCommands', () => {
  it('keeps generic document commands when dashboard creation is disabled', () => {
    expect(
      createDashboardCommands({
        artifactTypes: Object.fromEntries(
          CLI_ARTIFACT_TYPES.map((artifactType) => [
            artifactType,
            {canCreate: artifactType === 'document'},
          ]),
        ) as Record<CliArtifactType, {canCreate: boolean}>,
      }).map(({id}) => id),
    ).toEqual([
      'artifact.select',
      'artifact.rename',
      'document.create-artifact',
    ]);
  });

  it('renames artifacts through the artifact slice and preserves rename hooks', async () => {
    const events: string[] = [];
    const store = createArtifactStore(events);
    store.getState().artifacts.ensureArtifact('document-1', {
      type: 'document',
      title: 'Document',
    });
    const command = getCommand('artifact.rename');

    const result = await command.execute(createCommandContext(store.getState), {
      artifactId: 'document-1',
      title: '  Renamed Document  ',
    });

    expect(events).toEqual(['rename:document-1:Document:Renamed Document']);
    expect(result).toMatchObject({
      success: true,
      commandId: 'artifact.rename',
      data: {
        artifactId: 'document-1',
        artifactType: 'document',
        previousTitle: 'Document',
        title: 'Renamed Document',
      },
    });
  });

  it('returns a useful no-op result when the artifact title is unchanged', async () => {
    const events: string[] = [];
    const store = createArtifactStore(events);
    store.getState().artifacts.ensureArtifact('document-1', {
      type: 'document',
      title: 'Document',
    });
    const command = getCommand('artifact.rename');

    const result = await command.execute(createCommandContext(store.getState), {
      artifactId: 'document-1',
      title: 'Document',
    });

    expect(events).toEqual([]);
    expect(result).toMatchObject({
      success: true,
      commandId: 'artifact.rename',
      code: 'artifact-title-unchanged',
      data: {
        artifactId: 'document-1',
        artifactType: 'document',
        previousTitle: 'Document',
        title: 'Document',
      },
    });
  });

  it('validates missing artifacts and empty titles', async () => {
    const state = {
      artifacts: {
        getArtifact: () => undefined,
      },
    };
    const command = getCommand('artifact.rename');

    expect(() =>
      command.validateInput?.(
        {artifactId: 'missing', title: 'New title'},
        createCommandContext(() => state),
      ),
    ).toThrow('Unknown artifact "missing".');
    expect(() =>
      command.validateInput?.(
        {artifactId: 'missing', title: '   '},
        createCommandContext(() => state),
      ),
    ).toThrow('Artifact title cannot be empty.');
  });
});
