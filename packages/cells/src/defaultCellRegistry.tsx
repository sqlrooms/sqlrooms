import {makeQualifiedTableName} from '@sqlrooms/duckdb';
import {convertToValidColumnOrTableName} from '@sqlrooms/utils';
import {produce} from 'immer';
import {InputCellContent} from './components/InputCellContent';
import {SqlCellContent} from './components/SqlCellContent';
import {TextCellContent} from './components/TextCellContent';
import {VegaCellContent} from './components/VegaCellContent';
import {executeSqlCell} from './execution';
import {findSheetIdForCell, resolveSheetSchemaName} from './helpers';
import {
  findSqlDependencies,
  findSqlDependenciesFromAst,
  qualifySheetLocalResultNames,
  renderSqlWithInputs,
} from './sqlHelpers';
import type {
  Cell,
  CellRegistry,
  InputCell,
  SqlCell,
  SqlCellData,
  TextCell,
  VegaCell,
} from './types';
import {isInputCell} from './types';
import {getEffectiveResultName} from './utils';

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

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
          setCellResult: get().cells.setCellResult,
        });

        // Refresh table schemas after execution (fire and forget)
        void get().db.refreshTableSchemas();
      },
      renameResult: async ({id, oldResultView, get, set}) => {
        const state = get();
        const cell = state.cells.config.data[id];
        if (!cell || cell.type !== 'sql') return;

        const sheetId = findSheetIdForCell(state, id);
        const sheet = sheetId ? state.cells.config.sheets[sheetId] : undefined;
        const schemaName = sheet ? resolveSheetSchemaName(sheet) : 'main';

        const effectiveResultName = getEffectiveResultName(
          cell.data as SqlCellData,
          convertToValidColumnOrTableName,
        );
        const newTableName = makeQualifiedTableName({
          table: effectiveResultName,
          schema: schemaName,
          database: state.db.currentDatabase,
        }).toString();

        // Create new view from same SQL, drop old view
        const connector = await state.db.getConnector();
        const sql = (cell.data as SqlCellData).sql;
        const scopedCellIds =
          sheet?.cellIds ?? Object.keys(state.cells.config.data);
        const scopedCells = Object.fromEntries(
          scopedCellIds
            .map((cellId) => state.cells.config.data[cellId])
            .filter(isDefined)
            .map((candidate) => [candidate.id, candidate]),
        ) as Record<string, Cell>;

        // Gather inputs for SQL rendering
        const inputs = Object.values(scopedCells)
          .filter((c) => isInputCell(c))
          .map((c) => ({
            varName: c.data.input.varName,
            value: c.data.input.value as string | number,
          }));
        const renderedSql = renderSqlWithInputs(sql, inputs);
        const rewrittenSql = qualifySheetLocalResultNames({
          sql: renderedSql,
          sheetSchema: schemaName,
          sheetCellIds: scopedCellIds,
          cells: state.cells.config.data,
          getSqlResultName: (cellId) => {
            const c = state.cells.config.data[cellId];
            if (c?.type === 'sql') {
              return getEffectiveResultName(
                c.data as SqlCellData,
                convertToValidColumnOrTableName,
              );
            }
            return undefined;
          },
        });

        await connector.query(
          `CREATE OR REPLACE VIEW ${newTableName} AS ${rewrittenSql}`,
        );
        await connector.query(`DROP VIEW IF EXISTS ${oldResultView}`);

        // Update status with new view name
        set((s) =>
          produce(s, (draft) => {
            const status = draft.cells.status[id];
            if (status?.type === 'sql') {
              status.resultName = newTableName;
              status.resultView = newTableName;
            }
          }),
        );

        // Refresh schema tree
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
