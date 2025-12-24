import React from 'react';
import type {
  CellRegistry,
  Cell,
  SqlCell,
  TextCell,
  VegaCell,
  InputCell,
} from './types';
import {SqlCellContent} from './components/SqlCellContent';
import {TextCellContent} from './components/TextCellContent';
import {VegaCellContent} from './components/VegaCellContent';
import {InputCellContent} from './components/InputCellContent';
import {findSqlDependencies} from './sqlHelpers';

export function createDefaultCellRegistry(): CellRegistry {
  return {
    sql: {
      type: 'sql',
      title: 'SQL Query',
      createCell: (id: string): SqlCell => ({
        id,
        type: 'sql',
        data: {title: 'Untitled Query', sql: ''},
      }),
      renderCell: ({id, cell, renderContainer}) => (
        <SqlCellContent
          id={id}
          cell={cell as SqlCell}
          renderContainer={renderContainer}
        />
      ),
      findDependencies: ({cell, cells}) => {
        return findSqlDependencies({
          targetCell: cell,
          cells,
          getSqlText: (c) => (c as SqlCell).data.sql,
          getInputVarName: (c) =>
            c.type === 'input'
              ? (c as InputCell).data.input.varName
              : undefined,
          getSqlResultName: (cid) => {
            const c = cells[cid];
            return c?.type === 'sql' ? (c as SqlCell).data.title : undefined;
          },
        });
      },
    },
    text: {
      type: 'text',
      title: 'Text / Markdown',
      createCell: (id: string): TextCell => ({
        id,
        type: 'text',
        data: {title: 'Text', text: ''},
      }),
      renderCell: ({id, cell, renderContainer}) => (
        <TextCellContent
          id={id}
          cell={cell as TextCell}
          renderContainer={renderContainer}
        />
      ),
      findDependencies: () => [],
    },
    vega: {
      type: 'vega',
      title: 'Visualization',
      createCell: (id: string): VegaCell => ({
        id,
        type: 'vega',
        data: {
          title: 'Chart',
          vegaSpec: {
            data: {name: 'queryResult'},
            mark: 'bar',
            padding: 20,
          },
        },
      }),
      renderCell: ({id, cell, renderContainer}) => (
        <VegaCellContent
          id={id}
          cell={cell as VegaCell}
          renderContainer={renderContainer}
        />
      ),
      findDependencies: ({cell}) => {
        const sqlId = (cell as VegaCell).data.sqlId;
        return sqlId ? [sqlId] : [];
      },
    },
    input: {
      type: 'input',
      title: 'Input / Parameter',
      createCell: (id: string): InputCell => ({
        id,
        type: 'input',
        data: {
          title: 'Input',
          input: {
            kind: 'text',
            varName: `param_${id.slice(0, 4)}`,
            value: '',
          },
        },
      }),
      renderCell: ({id, cell, renderContainer}) => (
        <InputCellContent
          id={id}
          cell={cell as InputCell}
          renderContainer={renderContainer}
        />
      ),
      findDependencies: () => [],
    },
  };
}
