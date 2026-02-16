import {createStore} from 'zustand';
import {createBaseRoomSlice} from '@sqlrooms/room-store';
import {createCellsSlice} from '../src/cellsSlice';
import type {Cell, CellsRootState} from '../src/types';

function createTestStore() {
  return createStore<CellsRootState>()((...args) => ({
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
}

function sqlCell(id: string, title: string, sql: string): Cell {
  return {id, type: 'sql', data: {title, sql}};
}

describe('cells slice local dependency policy', () => {
  it('keeps downstream graph sheet-local', async () => {
    const store = createTestStore();
    const state = store.getState();
    const sheetA = state.cells.config.currentSheetId as string;
    const sheetB = state.cells.addSheet('Sheet B', 'notebook');

    await state.cells.addCell(sheetA, sqlCell('a1', 'A1', 'select 1 as v'));
    await state.cells.addCell(sheetA, sqlCell('a2', 'A2', 'select * from A1'));

    // Cross-sheet SQL text reference should not create DAG edges across sheets.
    await state.cells.addCell(sheetB, sqlCell('b1', 'B1', 'select * from A1'));

    const downstreamInA = store.getState().cells.getDownstream(sheetA, 'a1');
    const downstreamInB = store.getState().cells.getDownstream(sheetB, 'a1');

    expect(downstreamInA).toEqual(['a2']);
    expect(downstreamInA).not.toContain('b1');
    expect(downstreamInB).toEqual([]);
  });
});
