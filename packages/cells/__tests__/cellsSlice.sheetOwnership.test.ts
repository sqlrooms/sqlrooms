import {createStore} from 'zustand';
import {createBaseRoomSlice} from '@sqlrooms/room-store';
import {createCellsSlice} from '../src/cellsSlice';
import type {Cell, CellsRootState} from '../src/types';

type TestStore = ReturnType<typeof createTestStore>;

function createTestStore() {
  return createStore<CellsRootState>()((...args) => ({
    ...createBaseRoomSlice()(...args),
    db: {
      sqlSelectToJson: async () => ({error: false, statements: []}),
      getConnector: async () => {
        throw new Error('Not needed in this test');
      },
      refreshTableSchemas: async () => {},
      currentDatabase: 'main',
    },
    ...createCellsSlice()(...args),
  }));
}

function makeSqlCell(id: string, title: string, sql: string): Cell {
  return {id, type: 'sql', data: {title, sql}};
}

describe('cells slice sheet ownership semantics', () => {
  let store: TestStore;

  beforeEach(() => {
    store = createTestStore();
  });

  it('keeps default sheet id consistent with the map key', () => {
    const state = store.getState();
    const currentSheetId = state.cells.config.currentSheetId as string;
    const sheet = state.cells.config.sheets[currentSheetId];

    expect(sheet).toBeDefined();
    expect(sheet.id).toBe(currentSheetId);
    expect(state.cells.config.sheetOrder).toContain(currentSheetId);
  });

  it('enforces single-owner membership when same cell id is added to another sheet', async () => {
    const state = store.getState();
    const sheetA = state.cells.config.currentSheetId as string;
    const sheetB = state.cells.addSheet('Sheet B', 'notebook');
    const sharedId = 'shared-cell';

    await state.cells.addCell(sheetA, makeSqlCell(sharedId, 'A', 'select 1'));
    expect(store.getState().cells.config.sheets[sheetA]?.cellIds).toContain(
      sharedId,
    );

    await store
      .getState()
      .cells.addCell(sheetB, makeSqlCell(sharedId, 'A', 'select 1'));

    expect(store.getState().cells.config.sheets[sheetA]?.cellIds).not.toContain(
      sharedId,
    );
    expect(store.getState().cells.config.sheets[sheetB]?.cellIds).toContain(
      sharedId,
    );
  });

  it('hard-deletes owned cells when removing a sheet', async () => {
    const state = store.getState();
    const sheetId = state.cells.config.currentSheetId as string;

    await state.cells.addCell(sheetId, makeSqlCell('c1', 'Cell 1', 'select 1'));
    await state.cells.addCell(sheetId, makeSqlCell('c2', 'Cell 2', 'select 2'));
    state.cells.addEdge(sheetId, {source: 'c1', target: 'c2'});

    expect(store.getState().cells.config.data.c1).toBeDefined();
    expect(store.getState().cells.config.data.c2).toBeDefined();

    state.cells.removeSheet(sheetId);

    const after = store.getState();
    expect(after.cells.config.sheets[sheetId]).toBeUndefined();
    expect(after.cells.config.data.c1).toBeUndefined();
    expect(after.cells.config.data.c2).toBeUndefined();
    expect(after.cells.status.c1).toBeUndefined();
    expect(after.cells.status.c2).toBeUndefined();
  });

  it('throws a clear invariant error when parser is unavailable', async () => {
    const storeWithoutParser = createStore<CellsRootState>()((...args) => ({
      ...createBaseRoomSlice()(...args),
      db: {
        sqlSelectToJson: undefined,
        getConnector: async () => {
          throw new Error('Not needed in this test');
        },
        refreshTableSchemas: async () => {},
        currentDatabase: 'main',
      },
      ...createCellsSlice()(...args),
    }));
    const state = storeWithoutParser.getState();
    const sheetId = state.cells.config.currentSheetId as string;

    await expect(
      state.cells.addCell(sheetId, makeSqlCell('x', 'X', 'select 1')),
    ).rejects.toThrow(/requires db\.sqlSelectToJson/);
  });
});
