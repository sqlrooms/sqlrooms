import React from 'react';
import {produce} from 'immer';
import type {
  CellRegistry,
  Cell,
  SqlCell,
  SqlCellData,
  TextCell,
  VegaCell,
  InputCell,
} from './types';
import {getEffectiveResultName} from './types';
import {convertToValidColumnOrTableName} from '@sqlrooms/utils';
import {SqlCellContent} from './components/SqlCellContent';
import {TextCellContent} from './components/TextCellContent';
import {VegaCellContent} from './components/VegaCellContent';
import {InputCellContent} from './components/InputCellContent';
import {findSqlDependencies, findSqlDependenciesFromAst} from './sqlHelpers';
import {executeSqlCell} from './execution';

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
            if (c?.type === 'sql') {
              return getEffectiveResultName(
                c.data as SqlCellData,
                convertToValidColumnOrTableName,
              );
            }
            return undefined;
          },
        });
      },
      findDependenciesAsync: async ({cell, cells, sqlSelectToJson}) => {
        // Use AST-based detection if sqlSelectToJson is available
        if (sqlSelectToJson) {
          const astDeps = await findSqlDependenciesFromAst({
            sql: (cell as SqlCell).data.sql,
            cells,
            sqlSelectToJson,
          });
          // If AST parsing succeeded and found deps, use them
          // Otherwise fall back to text-based detection
          if (astDeps.length > 0) {
            return astDeps;
          }
        }
        // Fall back to sync text-based detection
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
            if (c?.type === 'sql') {
              return getEffectiveResultName(
                c.data as SqlCellData,
                convertToValidColumnOrTableName,
              );
            }
            return undefined;
          },
        });
      },
      runCell: async ({id, opts, get, set}) => {
        const controller = new AbortController();
        set((s) =>
          produce(s, (draft) => {
            draft.cells.activeAbortControllers[id] = controller;
          }),
        );

        await executeSqlCell(id, get, set, {
          schemaName: opts?.schemaName || 'main',
          cascade: opts?.cascade,
          signal: controller.signal,
        });

        // Refresh table schemas after execution (fire and forget)
        void get().db.refreshTableSchemas();
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
