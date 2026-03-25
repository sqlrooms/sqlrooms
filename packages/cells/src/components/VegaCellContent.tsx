import {Button, Tooltip, TooltipContent, TooltipTrigger} from '@sqlrooms/ui';
import {VegaLiteChart, useVegaChartContext} from '@sqlrooms/vega';
import {produce} from 'immer';
import {Filter} from 'lucide-react';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useCellsStore} from '../hooks';
import type {
  BrushFieldType,
  CellContainerProps,
  CrossFilterSelection,
  SqlCellStatus,
  VegaCell,
} from '../types';
import {BRUSH_PARAM_NAME} from '../vegaSelectionUtils';
import {CellSourceSelector} from './CellSourceSelector';
import {VegaConfigPanel} from './VegaConfigPanel';

/**
 * Attaches a debounced Vega signal listener for the brush param
 * and reports selection changes to the cross-filter state.
 */
function SelectionListener({
  cellId,
  sqlId,
  brushField,
  brushFieldType,
}: {
  cellId: string;
  sqlId: string;
  brushField: string;
  brushFieldType?: BrushFieldType;
}) {
  const {embed} = useVegaChartContext();
  const setCrossFilterSelection = useCellsStore(
    (s) => s.cells.setCrossFilterSelection,
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!embed?.view) return;
    const handler = (_name: string, value: any) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        if (!value || Object.keys(value).length === 0) {
          setCrossFilterSelection(cellId, sqlId, null);
          return;
        }
        const fieldValue = value[brushField];
        if (
          fieldValue != null &&
          Array.isArray(fieldValue) &&
          fieldValue.length === 2
        ) {
          const selection: CrossFilterSelection = {
            field: brushField,
            fieldType: brushFieldType,
            type: 'interval',
            value: fieldValue,
          };
          setCrossFilterSelection(cellId, sqlId, selection);
        } else {
          setCrossFilterSelection(cellId, sqlId, null);
        }
      }, 200);
    };
    try {
      embed.view.addSignalListener(BRUSH_PARAM_NAME, handler);
    } catch {
      // Signal doesn't exist yet (view is still rendering a spec without the brush param).
      // Will retry when embed reference changes after the new spec is compiled.
      return;
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      try {
        embed.view.removeSignalListener(BRUSH_PARAM_NAME, handler);
      } catch {
        // View may have been finalized
      }
    };
  }, [
    embed,
    cellId,
    sqlId,
    brushField,
    brushFieldType,
    setCrossFilterSelection,
  ]);

  return null;
}

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
  const getCrossFilterPredicate = useCellsStore(
    (s) => s.cells.getCrossFilterPredicate,
  );

  // Subscribe to cross-filter selections so we re-render when siblings change
  const selectedSqlId = cell.data.sqlId;
  const selectedTableRef = cell.data.tableRef;
  const crossFilterGroup = useCellsStore((s) =>
    selectedSqlId ? s.cells.crossFilterSelections[selectedSqlId] : undefined,
  );
  // Needed to satisfy exhaustive-deps for the memoized predicate
  void crossFilterGroup;

  const selectedSqlStatus = selectedSqlId
    ? cellsStatus[selectedSqlId]
    : undefined;

  const crossFilterEnabled = cell.data.crossFilter?.enabled !== false;
  const brushField = cell.data.crossFilter?.brushField;
  const brushFieldType = cell.data.crossFilter?.brushFieldType;

  const [draftSpec, setDraftSpec] = useState(
    cell.data.vegaSpec ?? {
      data: {name: 'queryResult'},
      mark: 'bar',
      padding: 20,
    },
  );
  const [isEditing, setIsEditing] = useState(false);

  const hasDataSource = !!(selectedSqlId || selectedTableRef);

  const baseSqlQuery = selectedTableRef
    ? `SELECT * FROM ${selectedTableRef}`
    : selectedSqlStatus?.type === 'sql' && selectedSqlStatus.resultView
      ? `SELECT * FROM ${selectedSqlStatus.resultView}`
      : selectedSqlId && cellsData[selectedSqlId]?.type === 'sql'
        ? (cellsData[selectedSqlId] as any).data.sql
        : '';

  const crossFilterPredicate =
    selectedSqlId && crossFilterEnabled
      ? getCrossFilterPredicate(id, selectedSqlId)
      : null;

  const selectedSqlQuery = crossFilterPredicate
    ? `${baseSqlQuery} WHERE ${crossFilterPredicate}`
    : baseSqlQuery;

  const lastRunTime =
    selectedSqlStatus?.type === 'sql'
      ? (selectedSqlStatus as SqlCellStatus).lastRunTime
      : undefined;

  // Encode selection value: "cell:<id>" or "table:<schema.table>"
  const selectValue = selectedSqlId
    ? `cell:${selectedSqlId}`
    : selectedTableRef
      ? `table:${selectedTableRef}`
      : undefined;

  const handleDataSourceChange = (value: string) => {
    updateCell(id, (c) =>
      produce(c, (draft) => {
        if (draft.type !== 'vega') return;
        if (value.startsWith('cell:')) {
          draft.data.sqlId = value.slice(5);
          delete draft.data.tableRef;
        } else if (value.startsWith('table:')) {
          draft.data.tableRef = value.slice(6);
          delete draft.data.sqlId;
        }
      }),
    );
  };

  const handleCrossFilterToggle = useCallback(
    (enabled: boolean) => {
      updateCell(id, (c) =>
        produce(c, (draft) => {
          if (draft.type === 'vega') {
            if (!draft.data.crossFilter) draft.data.crossFilter = {};
            draft.data.crossFilter.enabled = enabled;
          }
        }),
      );
    },
    [id, updateCell],
  );

  const handleBrushFieldChange = useCallback(
    (field: string | undefined) => {
      updateCell(id, (c) =>
        produce(c, (draft) => {
          if (draft.type === 'vega') {
            if (!draft.data.crossFilter) draft.data.crossFilter = {};
            draft.data.crossFilter.brushField = field;
          }
        }),
      );
    },
    [id, updateCell],
  );

  const handleBrushFieldTypeChange = useCallback(
    (fieldType: string | undefined) => {
      updateCell(id, (c) =>
        produce(c, (draft) => {
          if (draft.type === 'vega') {
            if (!draft.data.crossFilter) draft.data.crossFilter = {};
            draft.data.crossFilter.brushFieldType = fieldType;
          }
        }),
      );
    },
    [id, updateCell],
  );

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
      <CellSourceSelector
        value={selectValue}
        onValueChange={handleDataSourceChange}
      />
      <Button
        size="xs"
        variant="secondary"
        className="h-6"
        onClick={() => (isEditing ? saveSpec() : setIsEditing(true))}
        disabled={!hasDataSource}
      >
        {isEditing ? 'Save' : 'Edit chart'}
      </Button>
      {crossFilterEnabled && brushField && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center">
              <Filter
                className={`h-3.5 w-3.5 ${crossFilterPredicate ? 'text-blue-500' : 'text-gray-400'}`}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="text-xs">
              {crossFilterPredicate
                ? `Filtered: ${crossFilterPredicate}`
                : `Cross-filter on ${brushField}`}
            </p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );

  const showSelectionListener =
    crossFilterEnabled && brushField && selectedSqlId && selectedSqlStatus;

  const content = (
    <div className="flex h-[400px]">
      {isEditing && (
        <VegaConfigPanel
          sqlQuery={baseSqlQuery}
          lastRunTime={lastRunTime}
          spec={draftSpec}
          crossFilterEnabled={crossFilterEnabled}
          onSpecChange={setDraftSpec}
          onCrossFilterToggle={handleCrossFilterToggle}
          onBrushFieldChange={handleBrushFieldChange}
          onBrushFieldTypeChange={handleBrushFieldTypeChange}
        />
      )}
      <div
        onDoubleClick={() => hasDataSource && setIsEditing((prev) => !prev)}
        className="flex h-full w-full p-2"
      >
        {!hasDataSource ? (
          <div className="flex h-full w-full items-center justify-center text-gray-400">
            Please select a data source first.
          </div>
        ) : !selectedSqlStatus && !selectedTableRef ? (
          <div className="flex h-full w-full items-center justify-center text-gray-400">
            No chart data available, please run the SQL cell first.
          </div>
        ) : (
          <VegaLiteChart
            sqlQuery={selectedSqlQuery}
            spec={draftSpec}
            className="h-full w-full"
            aspectRatio={isEditing ? undefined : 3 / 2}
          >
            {showSelectionListener && (
              <SelectionListener
                cellId={id}
                sqlId={selectedSqlId}
                brushField={brushField}
                brushFieldType={brushFieldType}
              />
            )}
          </VegaLiteChart>
        )}
      </div>
    </div>
  );

  return renderContainer({
    header,
    content,
  });
};
