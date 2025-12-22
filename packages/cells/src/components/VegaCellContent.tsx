import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sqlrooms/ui';
import {VegaLiteChart} from '@sqlrooms/vega';
import {produce} from 'immer';
import React, {useCallback, useMemo, useState} from 'react';
import {useCellsStore} from '../hooks';
import type {Cell, CellContainerProps, VegaCell} from '../types';
import {VegaConfigPanel} from './VegaConfigPanel';

export type VegaCellContentProps = {
  id: string;
  cell: VegaCell;
  renderContainer: (props: CellContainerProps) => React.ReactElement;
};

export const VegaCellContent: React.FC<VegaCellContentProps> = ({
  id,
  cell,
  renderContainer,
}) => {
  const updateCell = useCellsStore((s) => s.cells.updateCell);
  const cellsData = useCellsStore((s) => s.cells.config.data);
  const cellsStatus = useCellsStore((s) => s.cells.status);

  // Find available SQL cells in the same sheet
  const currentSheetId = useCellsStore((s) => s.cells.config.currentSheetId);
  const sheetCellIds = useCellsStore((s) =>
    currentSheetId ? s.cells.config.sheets[currentSheetId]?.cellIds : undefined,
  );

  const availableSqlCells = useMemo(() => {
    if (!sheetCellIds) return [];
    return sheetCellIds
      .map((cid) => cellsData[cid])
      .filter((c): c is Cell & {type: 'sql'} => c?.type === 'sql');
  }, [sheetCellIds, cellsData]);

  const selectedSqlId = cell.data.sqlId;
  const selectedSqlStatus = selectedSqlId
    ? cellsStatus[selectedSqlId]
    : undefined;

  const [draftSpec, setDraftSpec] = useState(
    cell.data.vegaSpec ?? {
      data: {name: 'queryResult'},
      mark: 'bar',
      padding: 20,
    },
  );
  const [isEditing, setIsEditing] = useState(false);

  const selectedSqlQuery =
    selectedSqlStatus?.type === 'sql' && selectedSqlStatus.resultView
      ? `SELECT * FROM ${selectedSqlStatus.resultView}`
      : selectedSqlId && cellsData[selectedSqlId]?.type === 'sql'
        ? (cellsData[selectedSqlId] as any).data.sql
        : '';

  const lastRunTime =
    selectedSqlStatus?.type === 'sql'
      ? selectedSqlStatus.lastRunTime
      : undefined;

  const handleSqlIdChange = (value: string) => {
    updateCell(id, (c) =>
      produce(c, (draft) => {
        if (draft.type === 'vega') draft.data.sqlId = value;
      }),
    );
  };

  const saveSpec = useCallback(() => {
    updateCell(id, (c) =>
      produce(c, (draft) => {
        if (draft.type === 'vega') draft.data.vegaSpec = draftSpec;
      }),
    );
    setIsEditing(false);
  }, [id, draftSpec, updateCell]);

  const header = (
    <div className="flex items-center gap-2">
      <Select value={selectedSqlId} onValueChange={handleSqlIdChange}>
        <SelectTrigger className="h-6 w-[150px] text-xs shadow-none">
          <SelectValue placeholder="Select data source" />
        </SelectTrigger>
        <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
          {availableSqlCells.map((sql) => (
            <SelectItem className="text-xs" key={sql.id} value={sql.id}>
              {sql.data.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="xs"
        variant="secondary"
        className="h-6"
        onClick={() => (isEditing ? saveSpec() : setIsEditing(true))}
        disabled={!selectedSqlId}
      >
        {isEditing ? 'Save' : 'Edit chart'}
      </Button>
      <span className="text-[10px] font-bold uppercase text-gray-400">
        Vega
      </span>
    </div>
  );

  const content = (
    <div className="flex h-[400px]">
      {isEditing && (
        <VegaConfigPanel
          sqlQuery={selectedSqlQuery}
          lastRunTime={lastRunTime}
          spec={draftSpec}
          onSpecChange={setDraftSpec}
        />
      )}
      <div
        onDoubleClick={() => selectedSqlId && setIsEditing((prev) => !prev)}
        className="flex h-full w-full p-2"
      >
        {!selectedSqlId ? (
          <div className="flex h-full w-full items-center justify-center text-gray-400">
            Please select a SQL data source first.
          </div>
        ) : !selectedSqlStatus ? (
          <div className="flex h-full w-full items-center justify-center text-gray-400">
            No chart data available, please run the SQL cell first.
          </div>
        ) : (
          <VegaLiteChart
            sqlQuery={selectedSqlQuery}
            isLoading={
              selectedSqlStatus?.type === 'sql' &&
              selectedSqlStatus.status === 'running'
            }
            lastRunTime={lastRunTime}
            spec={draftSpec}
            className="h-full w-full"
            aspectRatio={isEditing ? undefined : 3 / 2}
          />
        )}
      </div>
    </div>
  );

  return renderContainer({
    header,
    content,
  });
};
