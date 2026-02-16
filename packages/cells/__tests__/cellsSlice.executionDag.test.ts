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
      findDependencies: ({cell}) => {
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
      sqlSelectToJson: undefined,
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
  let testStore: TestStore;

  beforeEach(() => {
    testStore = createTestStore();
  });

  it('runAllCellsCascade executes cells in topological order', async () => {
    const {store, executed} = testStore;
    const state = store.getState();
    const sheetId = state.cells.config.currentSheetId as string;

    await state.cells.addCell(sheetId, mockCell('a'));
    await state.cells.addCell(sheetId, mockCell('b', ['a']));
    await state.cells.addCell(sheetId, mockCell('c', ['b']));

    await state.cells.runAllCellsCascade(sheetId);

    expect(executed).toEqual(['a', 'b', 'c']);
  });

  it('runDownstreamCascade executes only reachable downstream cells', async () => {
    const {store, executed} = testStore;
    const state = store.getState();
    const sheetId = state.cells.config.currentSheetId as string;

    await state.cells.addCell(sheetId, mockCell('a'));
    await state.cells.addCell(sheetId, mockCell('b', ['a']));
    await state.cells.addCell(sheetId, mockCell('c', ['b']));
    await state.cells.addCell(sheetId, mockCell('d'));

    await state.cells.runDownstreamCascade(sheetId, 'a');

    expect(executed).toEqual(['b', 'c']);
    expect(executed).not.toContain('a');
    expect(executed).not.toContain('d');
  });

  it('does not cascade across sheets even if ids are referenced in SQL/deps text', async () => {
    const {store, executed} = testStore;
    const state = store.getState();
    const sheetA = state.cells.config.currentSheetId as string;
    const sheetB = state.cells.addSheet('Sheet B', 'notebook');

    await state.cells.addCell(sheetA, mockCell('a'));
    await state.cells.addCell(sheetA, mockCell('b', ['a']));

    // Cross-sheet reference should be ignored by sheet-local graph construction.
    await state.cells.addCell(sheetB, mockCell('x', ['a']));

    await state.cells.runDownstreamCascade(sheetA, 'a');

    expect(executed).toEqual(['b']);
    expect(executed).not.toContain('x');
  });
});
