import {makeQualifiedTableName} from '@sqlrooms/duckdb';
import {convertToValidColumnOrTableName} from '@sqlrooms/utils';
import {produce} from 'immer';
import {InputCellContent} from './components/InputCellContent';
import {SqlCellContent} from './components/SqlCellContent';
import {TextCellContent} from './components/TextCellContent';
import {VegaCellContent} from './components/VegaCellContent';
import {executeSqlCell} from './execution';
import {findSheetIdForCell, resolveSheetSchemaName} from './helpers';
import {dropResultRelation, renameResultRelation} from './resultRelationPolicy';
import {
  findSqlDependenciesFromAst,
  qualifySheetLocalResultNames,
  renderSqlWithInputs,
} from './sqlHelpers';
import type {
  Cell,
  CellRegistry,
  CellStatus,
  InputCell,
  SqlCell,
  SqlCellData,
  SqlCellStatus,
  TextCell,
  VegaCell,
} from './types';
import {isInputCell, isSqlCell} from './types';
import {getEffectiveResultName, isDefined} from './utils';

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
      findDependencies: async ({cell, cells, sqlSelectToJson}) => {
        return findSqlDependenciesFromAst({
          sql: (cell as SqlCell).data.sql,
          cells,
          sqlSelectToJson,
        });
      },
      createStatus: (): CellStatus => ({
        type: 'sql',
        status: 'idle',
        referencedTables: [],
      }),
      onRemove: async ({status, get}) => {
        if (status?.type === 'sql' && (status as SqlCellStatus).resultView) {
          try {
            const connector = await get().db.getConnector();
            await dropResultRelation({
              connector,
              relationName: (status as SqlCellStatus).resultView,
            });
          } catch {
            // best-effort
          }
        }
      },
      hasSemanticChange: (oldCell, newCell) => {
        const oldSql = isSqlCell(oldCell) ? oldCell.data.sql : undefined;
        const newSql = isSqlCell(newCell) ? newCell.data.sql : undefined;
        return oldSql !== newSql;
      },
      invalidateStatus: (currentStatus): CellStatus => ({
        type: 'sql',
        status: 'idle',
        referencedTables:
          (currentStatus as SqlCellStatus).referencedTables || [],
      }),
      getRelationsToDrop: (status): string[] => {
        const sqlStatus = status as SqlCellStatus;
        return sqlStatus.resultView ? [sqlStatus.resultView] : [];
      },
      recordError: (currentStatus, message): CellStatus => ({
        ...currentStatus,
        status: 'error',
        lastError: message,
      }),
      getResultRelation: (status): string | undefined => {
        const sqlStatus = status as SqlCellStatus;
        return sqlStatus.resultView;
      },
      runCell: async ({id, opts, get, set}) => {
        const ownerSheetId = findSheetIdForCell(get(), id);
        if (ownerSheetId) {
          await get().cells.updateEdgesFromSql(ownerSheetId, id);
        }

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

        void get().db.refreshTableSchemas();
      },
      renameResult: async ({id, oldResultView, get, set}) => {
        const state = get();
        const cell = state.cells.config.data[id];
        if (!cell || cell.type !== 'sql') return;
        const status = state.cells.status[id];
        const previousRelationType =
          (status?.type === 'sql'
            ? (status as SqlCellStatus).resultRelationType
            : undefined) ?? 'view';

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

        if (newTableName === oldResultView) {
          return;
        }

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

        await renameResultRelation({
          connector,
          oldRelationName: oldResultView,
          newRelationName: newTableName,
          relationType: previousRelationType,
          viewSql: rewrittenSql,
        });

        set((s) =>
          produce(s, (draft) => {
            const draftStatus = draft.cells.status[id];
            if (draftStatus?.type === 'sql') {
              (draftStatus as SqlCellStatus).resultName = newTableName;
              (draftStatus as SqlCellStatus).resultView = newTableName;
              (draftStatus as SqlCellStatus).resultRelationType =
                previousRelationType;
            }
          }),
        );

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
      findDependencies: async () => [],
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
      findDependencies: async ({cell}) => {
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
      findDependencies: async () => [],
    },
  };
}
