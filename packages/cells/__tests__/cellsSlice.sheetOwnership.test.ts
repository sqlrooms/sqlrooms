import {createBaseRoomSlice} from '@sqlrooms/room-store';
import React from 'react';
import {createStore} from 'zustand';
import {createCellsSlice} from '../src/cellsSlice';
import {findSqlDependenciesFromAst} from '../src/sqlHelpers';
import type {Cell, CellRegistry, CellsRootState, SqlCell} from '../src/types';

type TestStore = ReturnType<typeof createTestStore>;

const mockSqlSelectToJson: NonNullable<
  CellsRootState['db']['sqlSelectToJson']
> = async (sql: string) => {
  const fromMatch = sql.match(/from\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
  const table = fromMatch?.[1];
  return {
    error: false,
    statements: table
      ? [
          {
            node: {
              from_table: {
                alias: '',
                show_type: '',
                table_name: table,
              },
              select_list: [],
              type: 'select_node',
            },
          },
        ]
      : [],
  };
};

function createTestCellRegistry(): CellRegistry {
  return {
    sql: {
      type: 'sql',
      title: 'SQL Query',
      createCell: (id: string): SqlCell => ({
        id,
        type: 'sql',
        data: {title: id, sql: ''},
      }),
      renderCell: () => React.createElement('div'),
      findDependencies: async ({cell, cells, sqlSelectToJson}) =>
        findSqlDependenciesFromAst({
          sql: (cell as SqlCell).data.sql,
          cells,
          sqlSelectToJson,
        }),
    },
  };
}

function createTestStore() {
  return createStore<CellsRootState>()((...args) => ({
    ...createBaseRoomSlice()(...args),
    db: {
      sqlSelectToJson: mockSqlSelectToJson,
      getConnector: async () => {
        throw new Error('Not needed in this test');
      },
      refreshTableSchemas: async () => [],
      currentDatabase: 'main',
    } as unknown as CellsRootState['db'],
    ...createCellsSlice({cellRegistry: createTestCellRegistry()})(...args),
  }));
}

function makeSqlCell(id: string, title: string, sql: string): Cell {
  return {id, type: 'sql', data: {title, sql}};
}

describe('cells slice artifact ownership semantics', () => {
  const artifactA = 'artifact-a';
  const artifactB = 'artifact-b';
  let store: TestStore;

  beforeEach(() => {
    store = createTestStore();
  });

  it('keeps ensured artifact id consistent with the map key', () => {
    store.getState().cells.ensureArtifact(artifactA);
    const artifact = store.getState().cells.config.artifacts[artifactA];

    expect(artifact).toBeDefined();
    expect(artifact?.id).toBe(artifactA);
    expect(artifact?.schemaName).toBeDefined();
  });

  it('enforces single-owner membership when same cell id is added to another artifact', async () => {
    const state = store.getState();
    state.cells.ensureArtifact(artifactA);
    state.cells.ensureArtifact(artifactB);
    const sharedId = 'shared-cell';

    await state.cells.addCell(
      artifactA,
      makeSqlCell(sharedId, 'A', 'select 1'),
    );
    expect(
      store.getState().cells.config.artifacts[artifactA]?.cellIds,
    ).toContain(sharedId);

    await store
      .getState()
      .cells.addCell(artifactB, makeSqlCell(sharedId, 'A', 'select 1'));

    expect(
      store.getState().cells.config.artifacts[artifactA]?.cellIds,
    ).not.toContain(sharedId);
    expect(
      store.getState().cells.config.artifacts[artifactB]?.cellIds,
    ).toContain(sharedId);
  });

  it('hard-deletes owned cells when removing an artifact runtime', async () => {
    const state = store.getState();
    state.cells.ensureArtifact(artifactA);

    await state.cells.addCell(
      artifactA,
      makeSqlCell('c1', 'Cell 1', 'select 1'),
    );
    await state.cells.addCell(
      artifactA,
      makeSqlCell('c2', 'Cell 2', 'select 2'),
    );
    state.cells.addEdge(artifactA, {source: 'c1', target: 'c2'});

    expect(store.getState().cells.config.data.c1).toBeDefined();
    expect(store.getState().cells.config.data.c2).toBeDefined();

    state.cells.removeArtifact(artifactA);

    const after = store.getState();
    expect(after.cells.config.artifacts[artifactA]).toBeUndefined();
    expect(after.cells.config.data.c1).toBeUndefined();
    expect(after.cells.config.data.c2).toBeUndefined();
    expect(after.cells.status.c1).toBeUndefined();
    expect(after.cells.status.c2).toBeUndefined();
  });

  it('removes cell from graph cache on removeCell', async () => {
    const state = store.getState();
    state.cells.ensureArtifact(artifactA);
    await state.cells.addCell(
      artifactA,
      makeSqlCell('c1', 'Cell 1', 'select 1'),
    );
    await state.cells.addCell(
      artifactA,
      makeSqlCell('c2', 'Cell 2', 'select * from cell_1'),
    );

    expect(
      store.getState().cells.config.artifacts[artifactA]?.graphCache
        ?.dependencies.c2,
    ).toEqual(['c1']);

    state.cells.removeCell('c2');

    const cache =
      store.getState().cells.config.artifacts[artifactA]?.graphCache;
    expect(cache?.dependencies.c2).toBeUndefined();
    expect(cache?.dependents.c1 || []).not.toContain('c2');
  });

  it('throws a clear invariant error when parser is unavailable', async () => {
    const storeWithoutParser = createStore<CellsRootState>()((...args) => ({
      ...createBaseRoomSlice()(...args),
      db: {
        sqlSelectToJson:
          undefined as unknown as CellsRootState['db']['sqlSelectToJson'],
        getConnector: async () => {
          throw new Error('Not needed in this test');
        },
        refreshTableSchemas: async () => [],
        currentDatabase: 'main',
      } as unknown as CellsRootState['db'],
      ...createCellsSlice({cellRegistry: createTestCellRegistry()})(...args),
    }));
    const state = storeWithoutParser.getState();
    state.cells.ensureArtifact(artifactA);

    await expect(
      state.cells.addCell(artifactA, makeSqlCell('x', 'X', 'select 1')),
    ).rejects.toThrow(/requires db\.sqlSelectToJson/);
  });
});
