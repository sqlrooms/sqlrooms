import React, {useEffect, useState} from 'react';
import {
  Button,
  cn,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sqlrooms/ui';
import {VegaLiteChart} from '@sqlrooms/vega';

import {CellContainer} from '../CellContainer';
import {useStoreWithNotebook} from '../../useStoreWithNotebook';
import {findCellInNotebook, getCellTypeLabel} from '../../NotebookUtils';
import {VegaConfigPanel} from './VegaConfigPanel';
import {NotebookCell, VegaCell as VegaCellType} from '../../cellSchemas';
import {IconWithTooltip} from '../../cellOperations/IconWithTooltip';

export const VegaCell: React.FC<{id: string}> = ({id}) => {
  const {cell, dagCellIds} = useStoreWithNotebook((s) => {
    const info = findCellInNotebook(s as any, id);
    const dag = info?.dagId ? s.notebook.config.dags[info.dagId] : undefined;
    return {
      cell: info?.cell as VegaCellType | undefined,
      dagCellIds: dag?.meta.cellOrder || [],
    };
  });

  const cellsData = useStoreWithNotebook((s) => s.cells.data);
  const update = useStoreWithNotebook((s) => s.notebook.updateCell);
  const currentCellId = useStoreWithNotebook(
    (s) => s.notebook.config.currentCellId,
  );

  const availableSqlCells = dagCellIds
    .map((id) => cellsData[id])
    .filter((c): c is NotebookCell & {type: 'sql'} => c?.type === 'sql');

  const selectedSqlStatus = useStoreWithNotebook((s) =>
    cell?.type === 'vega' ? s.cells.status[cell.data.sqlId || ''] : undefined,
  );

  const lastRunTime =
    selectedSqlStatus?.type === 'sql'
      ? selectedSqlStatus?.lastRunTime
      : undefined;

  const [draftSpec, setDraftSpec] = useState(
    (cell?.type === 'vega'
      ? (cell.data.vegaSpec ?? {
          data: {name: 'queryResult'},
          mark: 'bar',
          padding: 20,
        })
      : {}) as VegaCellType['data']['vegaSpec'],
  );
  const [isEditing, setIsEditing] = useState(false);

  const selectedSqlQuery =
    selectedSqlStatus?.type === 'sql' && selectedSqlStatus.resultView
      ? `SELECT * FROM ${selectedSqlStatus.resultView}`
      : '';

  const isCurrent = currentCellId === id;

  const handleValueChange = (value: string) => {
    if (!cell) return;
    update(id, (c: any) => ({...c, data: {...c.data, sqlId: value}}) as any);
    if (!isEditing) setIsEditing(true);
  };

  useEffect(() => {
    if (currentCellId === id || !isEditing) {
      return;
    }
    const timeoutId = setTimeout(() => {
      setIsEditing(false);
      update(
        id,
        (c: any) => ({...c, data: {...c.data, vegaSpec: draftSpec}}) as any,
      );
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [currentCellId, id, isEditing, draftSpec, update]);

  if (!cell || cell.type !== 'vega') return null;

  return (
    <CellContainer
      id={id}
      typeLabel={getCellTypeLabel(cell.type)}
      leftControls={
        <Select value={cell.data.sqlId} onValueChange={handleValueChange}>
          <SelectTrigger className="h-6 text-xs shadow-none">
            <SelectValue placeholder="Select a SQL cell" />
          </SelectTrigger>
          <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
            {availableSqlCells.map((sql) => (
              <SelectItem className="text-xs" key={sql.id} value={sql.id}>
                {(sql.data as any).title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
      rightControls={
        isEditing ? (
          <Button
            size="xs"
            variant="secondary"
            className="h-6"
            onClick={() => {
              update(
                id,
                (c: any) =>
                  ({...c, data: {...c.data, vegaSpec: draftSpec}}) as any,
              );
              setIsEditing(false);
            }}
          >
            Save
          </Button>
        ) : (
          <IconWithTooltip
            title={!cell.data.sqlId ? 'Select a SQL cell first' : ''}
            icon={
              <Button
                size="xs"
                variant="secondary"
                onClick={() => setIsEditing(true)}
                className={cn({hidden: !isCurrent}, 'h-6 group-hover:flex')}
                disabled={!cell.data.sqlId}
              >
                Edit chart
              </Button>
            }
          />
        )
      }
    >
      <div className="flex h-[500px]">
        {isEditing && (
          <VegaConfigPanel
            sqlQuery={selectedSqlQuery}
            lastRunTime={lastRunTime}
            spec={draftSpec}
            onSpecChange={setDraftSpec}
          />
        )}
        <div
          onDoubleClick={() => setIsEditing((prev) => !prev)}
          className="flex h-full w-full"
        >
          {!draftSpec?.encoding ? (
            <div className="flex h-full w-full items-center justify-center text-gray-400">
              Empty chart, please 1) select a SQL cell and then 2) edit chart.
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
              className="rounded-b"
            />
          )}
        </div>
      </div>
    </CellContainer>
  );
};
