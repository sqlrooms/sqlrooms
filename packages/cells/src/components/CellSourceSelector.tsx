import {
  cn,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@sqlrooms/ui';
import {convertToValidColumnOrTableName} from '@sqlrooms/utils';
import React, {useMemo} from 'react';
import {useCellsStore} from '../hooks';
import {isSqlCell, SqlCell, type SqlCellData} from '../types';
import {getEffectiveResultName} from '../utils';
import {toDataSourceCell, toDataSourceTable} from '../helpers';

export type CellSourceSelectorProps = {
  artifactId: string;
  /** Current value in `cell:<id>` or `table:<schema.table>` format. */
  value?: string;
  /** Callback when the user selects a data source. Value is prefixed. */
  onValueChange: (value: string) => void;
  /** Optional className override for the trigger. */
  className?: string;
};

const GREEN_ITEM =
  '[&_svg]:text-accent-foreground font-mono text-xs text-green-500 data-[highlighted]:text-green-500';

export const CellSourceSelector: React.FC<CellSourceSelectorProps> = ({
  artifactId,
  value,
  onValueChange,
  className,
}) => {
  const cellsData = useCellsStore((s) => s.cells.config.data);
  const dbTables = useCellsStore((s) => s.db.tables);
  const tableDepSchemas = useCellsStore((s) => s.cells.config.tableDepSchemas);
  const artifactCellIds = useCellsStore((s) =>
    artifactId ? s.cells.config.artifacts[artifactId]?.cellIds : undefined,
  );

  const availableSqlCells = useMemo(() => {
    if (!artifactCellIds) return [];

    return artifactCellIds
      .map((cellId) => cellsData[cellId])
      .filter((candidate): candidate is SqlCell =>
        Boolean(candidate && isSqlCell(candidate)),
      );
  }, [artifactCellIds, cellsData]);

  const availableTables = useMemo(() => {
    const schemas = new Set(tableDepSchemas ?? ['main']);
    return dbTables.filter(
      (t) => !t.isView && t.table.schema != null && schemas.has(t.table.schema),
    );
  }, [dbTables, tableDepSchemas]);

  const hasValue = value != null;

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        className={cn('h-6 w-[180px] text-xs shadow-none', className, {
          '[&>span]:font-mono [&>span]:text-green-500': hasValue,
        })}
      >
        <SelectValue placeholder="Select data source" />
      </SelectTrigger>
      <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
        {availableSqlCells.length > 0 && (
          <SelectGroup>
            <SelectLabel className="text-muted-foreground text-[10px]">
              Cells
            </SelectLabel>
            {availableSqlCells.map((sqlCell) => (
              <SelectItem
                className={GREEN_ITEM}
                key={sqlCell.id}
                value={toDataSourceCell(sqlCell)}
              >
                {getEffectiveResultName(
                  sqlCell.data as SqlCellData,
                  convertToValidColumnOrTableName,
                )}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
        {availableTables.length > 0 && (
          <SelectGroup>
            <SelectLabel className="text-muted-foreground text-[10px]">
              Tables
            </SelectLabel>
            {availableTables.map((t) => {
              const qualifiedName = `${t.table.schema}.${t.table.table}`;

              return (
                <SelectItem
                  className={GREEN_ITEM}
                  key={qualifiedName}
                  value={toDataSourceTable(t.table)}
                >
                  {qualifiedName}
                </SelectItem>
              );
            })}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
};
