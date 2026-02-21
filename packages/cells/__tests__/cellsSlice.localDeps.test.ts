import {createStore} from 'zustand';
import {createBaseRoomSlice} from '@sqlrooms/room-store';
import {createCellsSlice} from '../src/cellsSlice';
import type {Cell, CellsRootState} from '../src/types';

function createTestStore() {
  return createStore<CellsRootState>()((...args) => ({
    ...createBaseRoomSlice()(...args),
    db: {
      sqlSelectToJson: async (sql: string) => {
        const fromMatch = sql.match(/from\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
        const table = fromMatch?.[1];
        return {
          error: false,
          statements: table ? [{node: {table_name: table}}] : [{node: {}}],
        };
      },
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

    const graphCacheA =
      store.getState().cells.config.sheets[sheetA]?.graphCache;
    const graphCacheB =
      store.getState().cells.config.sheets[sheetB]?.graphCache;
    expect(graphCacheA?.dependencies.a2).toEqual(['a1']);
    expect(graphCacheB?.dependencies.b1).toEqual([]);

    const downstreamInA = store.getState().cells.getDownstream(sheetA, 'a1');
    const downstreamInB = store.getState().cells.getDownstream(sheetB, 'a1');

    expect(downstreamInA).toEqual(['a2']);
    expect(downstreamInA).not.toContain('b1');
    expect(downstreamInB).toEqual([]);
  });

  it('does not use text fallback when AST parsing returns no table refs', async () => {
    const store = createStore<CellsRootState>()((...args) => ({
      ...createBaseRoomSlice()(...args),
      db: {
        sqlSelectToJson: async () => ({error: false, statements: [{node: {}}]}),
        getConnector: async () => {
          throw new Error('Not needed in this test');
        },
        refreshTableSchemas: async () => {},
        currentDatabase: 'main',
      },
      ...createCellsSlice()(...args),
    }));
    const state = store.getState();
    const sheetId = state.cells.config.currentSheetId as string;

    await state.cells.addCell(sheetId, sqlCell('a1', 'A1', 'select 1'));
    // Text reference exists, but AST parser yields no table_name nodes.
    await state.cells.addCell(sheetId, sqlCell('a2', 'A2', 'select * from A1'));

    const downstream = store.getState().cells.getDownstream(sheetId, 'a1');
    expect(downstream).toEqual([]);
  });

  it('invalidates graph cache on manual edge removal', async () => {
    const store = createTestStore();
    const state = store.getState();
    const sheetId = state.cells.config.currentSheetId as string;

    await state.cells.addCell(sheetId, sqlCell('a1', 'A1', 'select 1'));
    await state.cells.addCell(sheetId, sqlCell('a2', 'A2', 'select * from A1'));
    expect(
      store.getState().cells.config.sheets[sheetId]?.graphCache,
    ).toBeDefined();

    state.cells.removeEdge(sheetId, 'a1-a2');
    expect(
      store.getState().cells.config.sheets[sheetId]?.graphCache,
    ).toBeUndefined();
  });
});
