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
    worksheet: {
      label: 'Worksheet',
      defaultTitle: 'Worksheet',
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
  it('renames artifacts through the artifact slice and preserves rename hooks', async () => {
    const events: string[] = [];
    const store = createArtifactStore(events);
    store.getState().artifacts.ensureArtifact('worksheet-1', {
      type: 'worksheet',
      title: 'Worksheet',
    });
    const command = getCommand('artifact.rename');

    const result = await command.execute(createCommandContext(store.getState), {
      artifactId: 'worksheet-1',
      title: '  Renamed Worksheet  ',
    });

    expect(events).toEqual(['rename:worksheet-1:Worksheet:Renamed Worksheet']);
    expect(result).toMatchObject({
      success: true,
      commandId: 'artifact.rename',
      data: {
        artifactId: 'worksheet-1',
        artifactType: 'worksheet',
        previousTitle: 'Worksheet',
        title: 'Renamed Worksheet',
      },
    });
  });

  it('returns a useful no-op result when the artifact title is unchanged', async () => {
    const events: string[] = [];
    const store = createArtifactStore(events);
    store.getState().artifacts.ensureArtifact('worksheet-1', {
      type: 'worksheet',
      title: 'Worksheet',
    });
    const command = getCommand('artifact.rename');

    const result = await command.execute(createCommandContext(store.getState), {
      artifactId: 'worksheet-1',
      title: 'Worksheet',
    });

    expect(events).toEqual([]);
    expect(result).toMatchObject({
      success: true,
      commandId: 'artifact.rename',
      code: 'artifact-title-unchanged',
      data: {
        artifactId: 'worksheet-1',
        artifactType: 'worksheet',
        previousTitle: 'Worksheet',
        title: 'Worksheet',
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
