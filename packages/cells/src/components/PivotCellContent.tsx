import {
  PivotEditor,
  PivotResults,
  addAttributeFilterValuesInConfig,
  clearAttributeFilterInConfig,
  moveFieldInConfig,
  nextSortOrder,
  removeAttributeFilterValuesInConfig,
  setAttributeFilterValuesInConfig,
  type PivotSourceOption,
} from '@sqlrooms/pivot';
import {produce} from 'immer';
import React, {useMemo} from 'react';
import {getUnqualifiedSqlIdentifier} from '../helpers';
import {useCellsStore} from '../hooks';
import type {Cell, CellContainerProps, PivotCell} from '../types';

export type PivotCellContentProps = {
  id: string;
  cell: PivotCell;
  renderContainer: (props: CellContainerProps) => React.ReactElement;
};

export const PivotCellContent: React.FC<PivotCellContentProps> = ({
  id,
  cell,
  renderContainer,
}) => {
  const updateCell = useCellsStore((state) => state.cells.updateCell);
  const invalidateCellStatus = useCellsStore(
    (state) => state.cells.invalidateCellStatus,
  );
  const runCell = useCellsStore((state) => state.cells.runCell);
  const cellsData = useCellsStore((state) => state.cells.config.data);
  const cellsStatus = useCellsStore((state) => state.cells.status);
  const currentSheetId = useCellsStore(
    (state) => state.cells.config.currentSheetId,
  );
  const sheetCellIds = useCellsStore((state) =>
    currentSheetId ? state.cells.config.sheets[currentSheetId]?.cellIds : [],
  );
  const dbTables = useCellsStore((state) => state.db.tables);
  const status = cellsStatus[id];

  const sourceOptions = useMemo<PivotSourceOption[]>(() => {
    const tableOptions = dbTables.map((table) => ({
      value: `table:${table.tableName}`,
      label: table.tableName,
      source: {kind: 'table' as const, tableName: table.tableName},
      fields: table.columns.map((column) => ({
        name: column.name,
        type: column.type,
      })),
      relationName: table.table.toString(),
    }));
    const sqlOptions = (sheetCellIds ?? [])
      .map((cellId) => cellsData[cellId])
      .filter(
        (candidate): candidate is Cell & {type: 'sql'} =>
          candidate?.type === 'sql',
      )
      .filter((candidate) => candidate.id !== id)
      .map((sqlCell) => {
        const sqlStatus = cellsStatus[sqlCell.id];
        const relationName =
          sqlStatus?.type === 'sql' ? sqlStatus.resultView : undefined;
        const label =
          getUnqualifiedSqlIdentifier(relationName) ??
          sqlCell.data.resultName ??
          sqlCell.data.title;
        const relationTableName = getUnqualifiedSqlIdentifier(relationName);
        const table = relationTableName
          ? dbTables.find(
              (candidate) => candidate.tableName === relationTableName,
            )
          : undefined;
        return {
          value: `sql:${sqlCell.id}`,
          label,
          source: {kind: 'sql' as const, sqlId: sqlCell.id},
          fields: (table?.columns ?? []).map((column) => ({
            name: column.name,
            type: column.type,
          })),
          relationName,
        };
      });
    return [...tableOptions, ...sqlOptions];
  }, [cellsData, cellsStatus, dbTables, id, sheetCellIds]);

  const selectedSourceOption = useMemo(() => {
    if (!cell.data.source) return undefined;
    return sourceOptions.find((option) =>
      option.source.kind === 'table' && cell.data.source?.kind === 'table'
        ? option.source.tableName === cell.data.source.tableName
        : option.source.kind === 'sql' && cell.data.source?.kind === 'sql'
          ? option.source.sqlId === cell.data.source.sqlId
          : false,
    );
  }, [cell.data.source, sourceOptions]);

  const updatePivotCell = (updater: (draft: PivotCell) => void) => {
    void updateCell(id, (candidate) =>
      produce(candidate, (draft) => {
        if (draft.type === 'pivot') {
          updater(draft as PivotCell);
        }
      }),
    );
    invalidateCellStatus(id);
  };

  const content = (
    <PivotEditor
      title="Pivot output"
      sourceLabel="Source"
      sourceValue={selectedSourceOption?.value}
      sourceOptions={sourceOptions}
      config={cell.data.pivotConfig}
      availableFields={
        selectedSourceOption?.fields.filter(
          (field) =>
            !cell.data.pivotConfig.hiddenAttributes.includes(field.name),
        ) ?? []
      }
      sourceRelation={selectedSourceOption?.relationName}
      status={status?.type === 'pivot' ? status : undefined}
      onSourceChange={(value) => {
        const option = sourceOptions.find(
          (candidate) => candidate.value === value,
        );
        updatePivotCell((draft) => {
          draft.data.source = option?.source;
        });
      }}
      onRendererNameChange={(rendererName) =>
        updatePivotCell((draft) => {
          draft.data.pivotConfig.rendererName = rendererName;
        })
      }
      onAggregatorNameChange={(aggregatorName) =>
        updatePivotCell((draft) => {
          draft.data.pivotConfig.aggregatorName = aggregatorName;
        })
      }
      onValsChange={(vals) =>
        updatePivotCell((draft) => {
          draft.data.pivotConfig.vals = vals;
        })
      }
      onMoveField={(field, destination, index) => {
        updatePivotCell((draft) => {
          draft.data.pivotConfig = moveFieldInConfig(
            draft.data.pivotConfig,
            field,
            destination,
            index,
          );
        });
      }}
      onCycleRowOrder={() =>
        updatePivotCell((draft) => {
          draft.data.pivotConfig.rowOrder = nextSortOrder(
            draft.data.pivotConfig.rowOrder,
          );
        })
      }
      onCycleColOrder={() =>
        updatePivotCell((draft) => {
          draft.data.pivotConfig.colOrder = nextSortOrder(
            draft.data.pivotConfig.colOrder,
          );
        })
      }
      onSetFilterValues={(field, values) =>
        updatePivotCell((draft) => {
          draft.data.pivotConfig = setAttributeFilterValuesInConfig(
            draft.data.pivotConfig,
            field,
            values,
          );
        })
      }
      onAddFilters={(field, values) =>
        updatePivotCell((draft) => {
          draft.data.pivotConfig = addAttributeFilterValuesInConfig(
            draft.data.pivotConfig,
            field,
            values,
          );
        })
      }
      onRemoveFilters={(field, values) =>
        updatePivotCell((draft) => {
          draft.data.pivotConfig = removeAttributeFilterValuesInConfig(
            draft.data.pivotConfig,
            field,
            values,
          );
        })
      }
      onClearFilter={(field) =>
        updatePivotCell((draft) => {
          draft.data.pivotConfig = clearAttributeFilterInConfig(
            draft.data.pivotConfig,
            field,
          );
        })
      }
      onRun={() => void runCell(id)}
      results={
        <PivotResults
          config={cell.data.pivotConfig}
          relations={status?.type === 'pivot' ? status.relations : undefined}
        />
      }
    />
  );

  return renderContainer({content});
};
