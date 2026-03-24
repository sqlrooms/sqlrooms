import {Button} from '@sqlrooms/ui';
import {VegaLiteChart} from '@sqlrooms/vega';
import {produce} from 'immer';
import React, {useCallback, useState} from 'react';
import {useCellsStore} from '../hooks';
import type {
  CellContainerProps,
  VegaCell,
  SqlCell,
  SqlCellStatus,
} from '../types';
import {VegaConfigPanel} from './VegaConfigPanel';
import {VegaCellDatasetSelector} from './VegaCellDatasetSelector';

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
        ? (cellsData[selectedSqlId] as SqlCell).data.sql
        : '';

  const lastRunTime =
    selectedSqlStatus?.type === 'sql'
      ? (selectedSqlStatus as SqlCellStatus).lastRunTime
      : undefined;

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
      <VegaCellDatasetSelector cellId={id} />
      <Button
        size="xs"
        variant="secondary"
        className="h-6"
        onClick={() => (isEditing ? saveSpec() : setIsEditing(true))}
        disabled={!selectedSqlId}
      >
        {isEditing ? 'Save' : 'Edit chart'}
      </Button>
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
            // isLoading={
            //   selectedSqlStatus?.type === 'sql' &&
            //   selectedSqlStatus.status === 'running'
            // }
            // lastRunTime={lastRunTime}
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
