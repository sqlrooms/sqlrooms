import React from 'react';
import {createDefaultCellRegistry} from '../src/defaultCellRegistry';
import type {Cell, SqlCell} from '../src/types';

describe('default cell registry integration', () => {
  it('registers the expected built-in cell types', () => {
    const registry = createDefaultCellRegistry();

    expect(Object.keys(registry).sort()).toEqual([
      'input',
      'sql',
      'text',
      'vega',
    ]);
  });

  it('creates cells with expected defaults', () => {
    const registry = createDefaultCellRegistry();

    const sqlCell = registry.sql?.createCell('sql-1');
    const textCell = registry.text?.createCell('text-1');
    const vegaCell = registry.vega?.createCell('vega-1');
    const inputCell = registry.input?.createCell('input-1');

    expect(sqlCell.type).toBe('sql');
    expect(sqlCell.data.title).toBe('Untitled Query');
    expect(textCell.type).toBe('text');
    expect(vegaCell.type).toBe('vega');
    expect(inputCell.type).toBe('input');
  });

  it('uses SQL AST dependency extraction in sql.findDependencies', async () => {
    const registry = createDefaultCellRegistry();
    const source: SqlCell = {
      id: 'a1',
      type: 'sql',
      data: {title: 'A1', sql: 'select 1 as v'},
    };
    const target: SqlCell = {
      id: 'b1',
      type: 'sql',
      data: {title: 'B1', sql: 'select * from A1'},
    };
    const cells: Record<string, Cell> = {a1: source, b1: target};

    const deps = await registry.sql?.findDependencies({
      cell: target,
      cells,
      sheetId: 'sheet-1',
      sqlSelectToJson: async () =>
        ({error: false, statements: [{node: {table_name: 'a1'}}]}) as any,
    });

    expect(deps).toEqual(['a1']);
  });

  it('can render each built-in cell without throwing', () => {
    const registry = createDefaultCellRegistry();
    const renderContainer = ({content}: {content: React.ReactNode}) =>
      React.createElement('div', null, content);

    expect(
      registry.sql?.renderCell({
        id: 'sql-1',
        cell: registry.sql.createCell('sql-1'),
        renderContainer,
      }),
    ).toBeTruthy();
    expect(
      registry.text?.renderCell({
        id: 'text-1',
        cell: registry.text.createCell('text-1'),
        renderContainer,
      }),
    ).toBeTruthy();
    expect(
      registry.vega?.renderCell({
        id: 'vega-1',
        cell: registry.vega.createCell('vega-1'),
        renderContainer,
      }),
    ).toBeTruthy();
    expect(
      registry.input?.renderCell({
        id: 'input-1',
        cell: registry.input.createCell('input-1'),
        renderContainer,
      }),
    ).toBeTruthy();
  });
});
