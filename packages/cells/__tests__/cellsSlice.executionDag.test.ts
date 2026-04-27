import React from 'react';
import {createStore} from 'zustand';
import {createBaseRoomSlice} from '@sqlrooms/room-store';
import {createCellsSlice} from '../src/cellsSlice';
import type {Cell, CellRegistry, CellsRootState} from '../src/types';

type TestStore = ReturnType<typeof createTestStore>;

function createMockRegistry(executed: string[]): CellRegistry {
  return {
    mock: {
      type: 'mock',
      title: 'Mock',
      createCell: (id: string): Cell => ({
        id,
        type: 'mock',
        data: {title: id, dependsOn: [] as string[]},
      }),
      renderCell: () => React.createElement('div'),
      findDependencies: async ({cell}) => {
        const deps = (cell.data as {dependsOn?: string[]}).dependsOn;
        return deps ?? [];
      },
      runCell: async ({id}) => {
        executed.push(id);
      },
    },
  };
}

function createTestStore() {
  const executed: string[] = [];
  const registry = createMockRegistry(executed);

  const store = createStore<CellsRootState>()((...args) => ({
    ...createBaseRoomSlice()(...args),
    db: {
      sqlSelectToJson: async () => ({error: false, statements: []}),
      getConnector: async () => {
        throw new Error('Not needed in DAG tests');
      },
      refreshTableSchemas: async () => {},
      currentDatabase: 'main',
    },
    ...createCellsSlice({cellRegistry: registry})(...args),
  }));

  return {store, executed};
}

function mockCell(id: string, dependsOn: string[] = []): Cell {
  return {
    id,
    type: 'mock',
    data: {
      title: id,
      dependsOn,
    },
  };
}

describe('cells slice execution DAG model', () => {
  const artifactA = 'artifact-a';
  const artifactB = 'artifact-b';
  let testStore: TestStore;

  beforeEach(() => {
    testStore = createTestStore();
  });

  it('runAllCellsCascade executes cells in topological order', async () => {
    const {store, executed} = testStore;
    const state = store.getState();
    state.cells.ensureArtifact(artifactA);

    await state.cells.addCell(artifactA, mockCell('a'));
    await state.cells.addCell(artifactA, mockCell('b', ['a']));
    await state.cells.addCell(artifactA, mockCell('c', ['b']));

    await state.cells.runAllCellsCascade(artifactA);

    expect(executed).toEqual(['a', 'b', 'c']);
  });

  it('runDownstreamCascade executes only reachable downstream cells', async () => {
    const {store, executed} = testStore;
    const state = store.getState();
    state.cells.ensureArtifact(artifactA);

    await state.cells.addCell(artifactA, mockCell('a'));
    await state.cells.addCell(artifactA, mockCell('b', ['a']));
    await state.cells.addCell(artifactA, mockCell('c', ['b']));
    await state.cells.addCell(artifactA, mockCell('d'));

    await state.cells.runDownstreamCascade(artifactA, 'a');

    expect(executed).toEqual(['b', 'c']);
    expect(executed).not.toContain('a');
    expect(executed).not.toContain('d');
  });

  it('does not cascade across artifacts even if ids are referenced in deps text', async () => {
    const {store, executed} = testStore;
    const state = store.getState();
    state.cells.ensureArtifact(artifactA);
    state.cells.ensureArtifact(artifactB);

    await state.cells.addCell(artifactA, mockCell('a'));
    await state.cells.addCell(artifactA, mockCell('b', ['a']));

    // Cross-artifact reference should be ignored by artifact-local graph construction.
    await state.cells.addCell(artifactB, mockCell('x', ['a']));

    await state.cells.runDownstreamCascade(artifactA, 'a');

    expect(executed).toEqual(['b']);
    expect(executed).not.toContain('x');
  });
});
