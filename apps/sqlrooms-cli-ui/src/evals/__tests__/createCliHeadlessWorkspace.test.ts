import {expect, it} from '@jest/globals';
import {createCliHeadlessWorkspace} from '../createCliHeadlessWorkspace';
import {snapshotCliEvalState} from '../snapshot';

it('initializes, authors, snapshots and disposes without any AI slice or configuration', async () => {
  const workspace = createCliHeadlessWorkspace();
  try {
    await workspace.initialize();
    const state = workspace.store.getState();
    for (const key of ['ai', 'aiSettings', 'artifactAi'])
      expect(state).not.toHaveProperty(key);
    const invoke = async (id: string, input: unknown) => {
      const result = await state.commands.invokeCommand(id, input, {
        surface: 'mcp',
      });
      expect(result).toMatchObject({success: true});
      return result.data as {artifactId: string};
    };
    const {artifactId} = await invoke('block-document.create-artifact', {
      title: 'Proof',
    });
    await invoke('block-document.create-chart-block', {
      artifactId,
      tableName: '"analytics"."events"',
      config: {
        chartType: 'bar',
        x: {field: 'category'},
        y: {field: 'metric', aggregate: 'sum'},
      },
    });
    await invoke('block-document.add-map-block', {
      blockDocumentId: artifactId,
      title: 'Events',
      tableName: '"analytics"."events"',
      reasoning: 'Show event locations',
      config: {
        datasets: {events: {source: {tableName: '"analytics"."events"'}}},
        spec: {
          layers: [
            {
              '@@type': 'GeoArrowScatterplotLayer',
              _sqlroomsBinding: {
                dataset: 'events',
                longitudeColumn: 'longitude',
                latitudeColumn: 'latitude',
              },
            },
          ],
        },
        fitToData: {
          dataset: 'events',
          longitudeColumn: 'longitude',
          latitudeColumn: 'latitude',
        },
      },
    });
    const snapshot = snapshotCliEvalState(workspace.store.getState());
    expect(snapshot.documents).toHaveLength(1);
    expect(snapshot.maps).toHaveLength(1);
    expect(JSON.stringify(snapshot)).toContain('analytics');
    const document = workspace.store
      .getState()
      .blockDocuments.getBlocks(artifactId);
    expect(document.map((block) => block.type)).toEqual([
      'chart',
      'statefulBlock',
    ]);
    workspace.store.getState().artifacts.deleteArtifact(artifactId);
    expect(snapshotCliEvalState(workspace.store.getState()).maps).toEqual([]);
  } finally {
    await workspace.dispose();
  }
  await workspace.dispose();
  await expect(workspace.initialize()).rejects.toThrow('disposed');
});
