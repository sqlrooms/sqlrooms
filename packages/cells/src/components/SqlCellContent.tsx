import {getCoreDuckDbConnectionId} from '@sqlrooms/db';
import {useRoomStoreApi} from '@sqlrooms/room-store';
import {convertToValidColumnOrTableName} from '@sqlrooms/utils';
import {type Draft, produce} from 'immer';
import {CornerDownRightIcon} from 'lucide-react';
import React, {useCallback, useEffect, useMemo, useRef} from 'react';
import {useCellsStore} from '../hooks';
import type {CellContainerProps, CellsRootState, SqlCell} from '../types';
import {getEffectiveResultName, getResultNameValidationError} from '../utils';
import {SqlCellConnectionSelector} from './SqlCellConnectionSelector';
import {SqlCellDependentsMenu} from './SqlCellDependentsMenu';
import {SqlCellEditor} from './SqlCellEditor';
import {SqlCellResultNameEditor} from './SqlCellResultNameEditor';
import {SqlCellResults} from './SqlCellResults';
import {SqlCellRunButton} from './SqlCellRunButton';

export type SqlCellContentProps = {
  id: string;
  cell: SqlCell;
  renderContainer: (props: CellContainerProps) => React.ReactElement;
};

export const SqlCellContent: React.FC<SqlCellContentProps> = ({
  id,
  cell,
  renderContainer,
}) => {
  const storeApi = useRoomStoreApi<CellsRootState>();
  const updateCell = useCellsStore((s) => s.cells.updateCell);
  const runCell = useCellsStore((s) => s.cells.runCell);
  const cancelCell = useCellsStore((s) => s.cells.cancelCell);
  const getDownstream = useCellsStore((s) => s.cells.getDownstream);
  const currentSheetId = useCellsStore((s) => s.cells.config.currentSheetId);
  const cellsData = useCellsStore((s) => s.cells.config.data);
  const sheets = useCellsStore((s) => s.cells.config.sheets);
  const cellStatus = useCellsStore((s) => s.cells.status[id]);
  const resultVersion = useCellsStore((s) => s.cells.resultVersion?.[id] ?? 0);
  const pageVersion = useCellsStore((s) => s.cells.pageVersion?.[id] ?? 0);
  const getCellResult = useCellsStore((s) => s.cells.getCellResult);
  const fetchCellResultPage = useCellsStore((s) => s.cells.fetchCellResultPage);
  const dbConnections = useCellsStore((s) => s.db.config.connections);
  const connector = useCellsStore((s) => s.db.connector);
  const tableSchemas = useCellsStore((s) => s.db.tables);

  // Re-read the cache whenever resultVersion or pageVersion changes
  const cellResult = useMemo(
    () => getCellResult(id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getCellResult, id, resultVersion, pageVersion],
  );

  const handleSqlChange = useCallback(
    (v: string | undefined) => {
      updateCell(id, (c) =>
        produce(c, (draft) => {
          if (draft.type === 'sql') {
            draft.data.sql = v || '';
          }
        }),
      );
    },
    [id, updateCell],
  );

  const handleRun = useCallback(() => {
    runCell(id);
  }, [id, runCell]);

  const handleRunQuery = useCallback(
    (query: string) => {
      // Sync the actual query being executed to store before running
      // to avoid race condition with onChange callback
      storeApi.setState(
        produce(storeApi.getState(), (draft: Draft<CellsRootState>) => {
          const c = draft.cells?.config?.data?.[id];
          if (c && c.type === 'sql') {
            c.data.sql = query;
          }
        }),
      );
      handleRunRef.current();
    },
    [id, storeApi],
  );

  const handleConnectorChange = useCallback(
    (connectorId: string) => {
      updateCell(id, (c) =>
        produce(c, (draft) => {
          if (draft.type === 'sql') {
            draft.data.connectorId = connectorId || undefined;
          }
        }),
      );
    },
    [id, updateCell],
  );

  const handleCancel = useCallback(() => {
    cancelCell(id);
  }, [id, cancelCell]);

  const handleResultNameChange = useCallback(
    (value: string) => {
      updateCell(id, (c) =>
        produce(c, (draft) => {
          if (draft.type === 'sql') {
            draft.data.resultName = value;
          }
        }),
      );
    },
    [id, updateCell],
  );

  const effectiveResultName = getEffectiveResultName(
    cell.data,
    convertToValidColumnOrTableName,
  );
  const explicitResultName = cell.data.resultName || '';
  const selectedConnectorId =
    cell.data.connectorId || getCoreDuckDbConnectionId();

  const status =
    cellStatus?.type === 'sql'
      ? {
          state: cellStatus.status,
          message: cellStatus.lastError,
          resultName: cellStatus.resultView || cellStatus.resultName,
          lastRunTime: cellStatus.lastRunTime,
        }
      : undefined;

  const resultName = status?.resultName;
  const isRunning = status?.state === 'running';

  // Compute the list of main-schema table names to check against.
  // DataTable exposes schema/tableName both via the modern `table` object and
  // via deprecated top-level fields for backward compatibility.
  const mainSchemaTableNames = useMemo(
    () =>
      tableSchemas
        .filter((t) => (t.table.schema ?? t.schema) === 'main')
        .map((t) => t.table.table ?? t.tableName),
    [tableSchemas],
  );

  // Compute the sheet cell IDs for collision detection
  const sheetCellIds = useMemo(
    () => (currentSheetId ? (sheets[currentSheetId]?.cellIds ?? []) : []),
    [currentSheetId, sheets],
  );

  // Validation function that checks for collisions, main-schema conflicts, and cycles
  const getValidationError = useCallback(
    (name: string) =>
      getResultNameValidationError({
        proposedName: name,
        currentCellId: id,
        currentCellSql: cell.data.sql,
        sheetCellIds,
        cells: cellsData,
        mainSchemaTableNames,
        convertToValidName: convertToValidColumnOrTableName,
      }),
    [id, cell.data.sql, sheetCellIds, cellsData, mainSchemaTableNames],
  );

  const handleRunRef = useRef(handleRun);
  useEffect(() => {
    handleRunRef.current = handleRun;
  }, [handleRun]);

  const content = (
    <div className="flex flex-col">
      <SqlCellEditor
        sql={cell.data.sql}
        connector={connector}
        tableSchemas={tableSchemas}
        onChange={handleSqlChange}
        onRunQuery={handleRunQuery}
      />
      <SqlCellResults
        cellId={id}
        cellResult={cellResult}
        resultName={resultName}
        isRunning={isRunning}
        errorMessage={status?.state === 'error' ? status.message : undefined}
        resultVersion={resultVersion}
        fetchCellResultPage={fetchCellResultPage}
      />
    </div>
  );

  const footer = (
    <div className="text-muted-foreground flex items-center gap-1 px-2 py-1 text-xs">
      <CornerDownRightIcon className="h-3 w-3" />
      <SqlCellDependentsMenu
        cellId={id}
        currentSheetId={currentSheetId}
        cellsData={cellsData}
        sheets={sheets}
        getDownstream={getDownstream}
      />
      <SqlCellResultNameEditor
        value={explicitResultName}
        placeholder={effectiveResultName}
        onChange={handleResultNameChange}
        getValidationError={getValidationError}
      />
    </div>
  );

  return renderContainer({
    header: (
      <div className="flex w-full items-center gap-2">
        <SqlCellConnectionSelector
          connectors={dbConnections}
          selectedConnectorId={selectedConnectorId}
          onChange={handleConnectorChange}
        />
        <SqlCellRunButton
          onRun={handleRun}
          onCancel={handleCancel}
          status={status}
          runLabel="Run"
        />
      </div>
    ),
    content,
    footer,
  });
};
