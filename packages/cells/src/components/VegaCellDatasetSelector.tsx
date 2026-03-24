import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sqlrooms/ui';
import {produce} from 'immer';
import React, {useMemo} from 'react';
import {useCellsStore} from '../hooks';
import type {SqlCell} from '../types';

export type VegaCellDatasetSelectorProps = {
  cellId: string;
};

export const VegaCellDatasetSelector: React.FC<
  VegaCellDatasetSelectorProps
> = ({cellId}) => {
  const updateCell = useCellsStore((s) => s.cells.updateCell);
  const cellsData = useCellsStore((s) => s.cells.config.data);
  const currentSheetId = useCellsStore((s) => s.cells.config.currentSheetId);
  const sheetCellIds = useCellsStore((s) =>
    currentSheetId ? s.cells.config.sheets[currentSheetId]?.cellIds : undefined,
  );

  const availableSqlCells = useMemo(() => {
    return (sheetCellIds ?? [])
      .map((cid) => cellsData[cid])
      .filter((c): c is SqlCell => c?.type === 'sql');
  }, [sheetCellIds, cellsData]);

  const cell = cellsData[cellId];
  const selectedSqlId = cell?.type === 'vega' ? cell.data.sqlId : undefined;

  const handleSqlIdChange = (value: string) => {
    updateCell(cellId, (c) =>
      produce(c, (draft) => {
        if (draft.type === 'vega') draft.data.sqlId = value;
      }),
    );
  };

  return (
    <Select value={selectedSqlId} onValueChange={handleSqlIdChange}>
      <SelectTrigger className="h-6 w-[150px] text-xs shadow-none [&>span]:font-mono [&>span]:text-green-500">
        <SelectValue placeholder="Select data source" />
      </SelectTrigger>
      <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
        {availableSqlCells.map((sql) => (
          <SelectItem
            className="[&_svg]:text-accent-foreground font-mono text-xs text-green-500 data-[highlighted]:text-green-500"
            key={sql.id}
            value={sql.id}
          >
            {sql.data.resultName ?? ''}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
