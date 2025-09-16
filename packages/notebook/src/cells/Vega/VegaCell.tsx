import React, {useState} from 'react';
import {
  Button,
  cn,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sqlrooms/ui';
import {VegaLiteChart, VisualizationSpec} from '@sqlrooms/vega';

import {CellContainer} from '../CellContainer';
import {useStoreWithNotebook} from '../../NotebookSlice';
import {getCellTypeLabel} from '../../NotebookUtils';
import {VegaConfigPanel} from './VegaConfigPanel';

export const VegaCell: React.FC<{id: string}> = ({id}) => {
  const cell = useStoreWithNotebook((s) => s.config.notebook.cells[id]);
  const update = useStoreWithNotebook((s) => s.notebook.updateCell);
  const currentCellId = useStoreWithNotebook(
    (s) => s.config.notebook.currentCellId,
  );
  const availableSqlCells = Object.values(
    useStoreWithNotebook((s) => s.config.notebook.cells),
  ).filter((c) => c.type === 'sql');

  const selectedSqlStatus = useStoreWithNotebook((s) =>
    cell && cell.type === 'vega' && cell.sqlId
      ? s.notebook.cellStatus[cell.sqlId]
      : undefined,
  );

  const [isEditing, setIsEditing] = useState(false);
  const [chartSpec, setChartSpec] = useState<VisualizationSpec>({
    data: {name: 'queryResult'},
    mark: 'bar',
    padding: 20,
    encoding: {
      x: {field: 'MagType'},
      y: {field: 'Depth', aggregate: 'sum'},
    },
  });

  if (!cell || cell.type !== 'vega') return null;

  const selectedSqlQuery =
    selectedSqlStatus?.type === 'sql' && selectedSqlStatus.resultView
      ? `SELECT * FROM ${selectedSqlStatus.resultView}`
      : '';

  const isCurrent = currentCellId === id;

  const handleValueChange = (value: string) =>
    update(id, (c) => ({...c, sqlId: value}) as typeof cell);

  return (
    <CellContainer
      id={id}
      typeLabel={getCellTypeLabel(cell.type)}
      leftControls={
        <Select value={cell.sqlId} onValueChange={handleValueChange}>
          <SelectTrigger className="h-7 text-xs">
            <SelectValue placeholder="Select a sql cell" />
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
        <Button
          size="xs"
          variant="secondary"
          onClick={() => setIsEditing((prev) => !prev)}
          className={cn({hidden: !isCurrent}, 'group-hover:flex')}
        >
          {isEditing ? 'Done' : 'Edit Chart'}
        </Button>
      }
    >
      <div className="flex">
        {isEditing && (
          <VegaConfigPanel
            sqlQuery={selectedSqlQuery}
            spec={chartSpec}
            onSpecChange={setChartSpec}
          />
        )}
        <div
          onDoubleClick={() => setIsEditing((prev) => !prev)}
          className="h-full w-full"
        >
          <VegaLiteChart
            sqlQuery={selectedSqlQuery}
            spec={chartSpec}
            aspectRatio={2 / 1}
          />
        </div>
      </div>
    </CellContainer>
  );
};
