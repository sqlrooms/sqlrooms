import React from 'react';
import {createStore} from 'zustand';
import {createBaseRoomSlice} from '@sqlrooms/room-store';
import {createCellsSlice} from '../src/cellsSlice';
import {findSqlDependenciesFromAst} from '../src/sqlHelpers';
import type {Cell, CellRegistry, CellsRootState, SqlCell} from '../src/types';

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

function createTestStore(
  sqlSelectToJson: NonNullable<
    CellsRootState['db']['sqlSelectToJson']
  > = mockSqlSelectToJson,
) {
  return createStore<CellsRootState>()((...args) => ({
    ...createBaseRoomSlice()(...args),
    db: {
      sqlSelectToJson,
      getConnector: async () => {
        throw new Error('Not needed in this test');
      },
      refreshTableSchemas: async () => [],
      currentDatabase: 'main',
    } as unknown as CellsRootState['db'],
    ...createCellsSlice({cellRegistry: createTestCellRegistry()})(...args),
  }));
}

function sqlCell(id: string, title: string, sql: string): Cell {
  return {id, type: 'sql', data: {title, sql}};
}

describe('cells slice local dependency policy', () => {
  const artifactA = 'artifact-a';
  const artifactB = 'artifact-b';

  it('keeps downstream graph artifact-local', async () => {
    const store = createTestStore();
    const state = store.getState();
    state.cells.ensureArtifact(artifactA);
    state.cells.ensureArtifact(artifactB);

    await state.cells.addCell(artifactA, sqlCell('a1', 'A1', 'select 1 as v'));
    await state.cells.addCell(
      artifactA,
      sqlCell('a2', 'A2', 'select * from A1'),
    );

    // Cross-artifact SQL text reference should not create DAG edges across artifacts.
    await state.cells.addCell(
      artifactB,
      sqlCell('b1', 'B1', 'select * from A1'),
    );

    const graphCacheA =
      store.getState().cells.config.artifacts[artifactA]?.graphCache;
    const graphCacheB =
      store.getState().cells.config.artifacts[artifactB]?.graphCache;
    expect(graphCacheA?.dependencies.a2).toEqual(['a1']);
    expect(graphCacheB?.dependencies.b1).toEqual([]);

    const downstreamInA = store.getState().cells.getDownstream(artifactA, 'a1');
    const downstreamInB = store.getState().cells.getDownstream(artifactB, 'a1');

    expect(downstreamInA).toEqual(['a2']);
    expect(downstreamInA).not.toContain('b1');
    expect(downstreamInB).toEqual([]);
  });

  it('does not use text fallback when AST parsing returns no table refs', async () => {
    const store = createTestStore(async () => ({error: false, statements: []}));
    const state = store.getState();
    state.cells.ensureArtifact(artifactA);

    await state.cells.addCell(artifactA, sqlCell('a1', 'A1', 'select 1'));
    // Text reference exists, but AST parser yields no table_name nodes.
    await state.cells.addCell(
      artifactA,
      sqlCell('a2', 'A2', 'select * from A1'),
    );

    const downstream = store.getState().cells.getDownstream(artifactA, 'a1');
    expect(downstream).toEqual([]);
  });

  it('invalidates graph cache on manual edge removal', async () => {
    const store = createTestStore();
    const state = store.getState();
    state.cells.ensureArtifact(artifactA);

    await state.cells.addCell(artifactA, sqlCell('a1', 'A1', 'select 1'));
    await state.cells.addCell(
      artifactA,
      sqlCell('a2', 'A2', 'select * from A1'),
    );
    expect(
      store.getState().cells.config.artifacts[artifactA]?.graphCache,
    ).toBeDefined();

    state.cells.removeEdge(artifactA, 'a1-a2');
    expect(
      store.getState().cells.config.artifacts[artifactA]?.graphCache,
    ).toBeUndefined();
  });

  it('stores unmatched table references as tableDependencies in graph cache', async () => {
    const store = createTestStore();
    const state = store.getState();
    state.cells.ensureArtifact(artifactA);

    // "flights" doesn't match any cell title => it's an external table dependency
    await state.cells.addCell(
      artifactA,
      sqlCell('q1', 'Q1', 'select * from flights'),
    );

    const graphCache =
      store.getState().cells.config.artifacts[artifactA]?.graphCache;
    expect(graphCache?.tableDependencies?.q1).toEqual(['flights']);
    // No cell deps since "flights" is not another cell
    expect(graphCache?.dependencies.q1).toEqual([]);
  });
});
