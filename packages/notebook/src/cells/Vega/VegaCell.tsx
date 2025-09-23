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
import {useStoreWithNotebook} from '../../NotebookSlice';
import {getCellTypeLabel} from '../../NotebookUtils';
import {VegaConfigPanel} from './VegaConfigPanel';
import {VegaCell as VegaCellType} from '../../cellSchemas';
import {IconWithTooltip} from '../../cellOperations/IconWithTooltip';

export const VegaCell: React.FC<{id: string}> = ({id}) => {
  const cell = useStoreWithNotebook(
    (s) => s.config.notebook.cells[id],
  ) as VegaCellType;
  const update = useStoreWithNotebook((s) => s.notebook.updateCell);
  const currentCellId = useStoreWithNotebook(
    (s) => s.config.notebook.currentCellId,
  );
  const availableSqlCells = Object.values(
    useStoreWithNotebook((s) => s.config.notebook.cells),
  ).filter((c) => c.type === 'sql');

  const selectedSqlStatus = useStoreWithNotebook(
    (s) => s.notebook.cellStatus[cell.sqlId],
  );

  const [draftSpec, setDraftSpec] = useState(
    cell.vegaSpec ?? {
      data: {name: 'queryResult'},
      mark: 'bar',
      padding: 20,
    },
  );
  const [isEditing, setIsEditing] = useState(false);

  const selectedSqlQuery =
    selectedSqlStatus?.type === 'sql' && selectedSqlStatus.resultView
      ? `SELECT * FROM ${selectedSqlStatus.resultView}`
      : '';

  const isCurrent = currentCellId === id;

  const handleValueChange = (value: string) => {
    update(id, (c) => ({...c, sqlId: value}) as typeof cell);
    // Auto open the chart config panel if not opened yet
    if (!isEditing) setIsEditing(true);
  };

  useEffect(() => {
    if (currentCellId !== id && isEditing) {
      setIsEditing(false);
      update(id, (c) => ({...c, vegaSpec: draftSpec}));
    }
  }, [currentCellId, id, isEditing, draftSpec, update]);

  if (!cell || cell.type !== 'vega') return null;

  return (
    <CellContainer
      id={id}
      typeLabel={getCellTypeLabel(cell.type)}
      leftControls={
        <Select value={cell.sqlId} onValueChange={handleValueChange}>
          <SelectTrigger className="h-6 text-xs shadow-none">
            <SelectValue placeholder="Select a SQL cell" />
          </SelectTrigger>
          <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
            {availableSqlCells.map((sql) => (
              <SelectItem className="text-xs" key={sql.id} value={sql.id}>
                {sql.name}
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
              update(id, (c) => ({...c, vegaSpec: draftSpec}));
              setIsEditing(false);
            }}
          >
            Save
          </Button>
        ) : (
          <IconWithTooltip
            title={!cell.sqlId ? 'Select a SQL cell first' : ''}
            icon={
              <Button
                size="xs"
                variant="secondary"
                onClick={() => setIsEditing(true)}
                className={cn({hidden: !isCurrent}, 'h-6 group-hover:flex')}
                disabled={!cell.sqlId}
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
            spec={draftSpec}
            onSpecChange={setDraftSpec}
          />
        )}
        <div
          onDoubleClick={() => setIsEditing((prev) => !prev)}
          className="flex h-full w-full"
        >
          {draftSpec?.encoding ? (
            <VegaLiteChart sqlQuery={selectedSqlQuery} spec={draftSpec} />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
              Empty chart, please 1) select a SQL cell and then 2) edit chart.
            </div>
          )}
        </div>
      </div>
    </CellContainer>
  );
};
