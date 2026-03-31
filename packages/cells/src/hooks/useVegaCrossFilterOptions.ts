import {useCellsStore} from '../hooks';
import type {BrushFieldType, VegaCell} from '../types';

type UseVegaCrossFilterOptionsParams = {
  crossFilterEnabled: boolean;
  crossFilterPredicate: string | null;
  brushField: string | null;
  brushFieldType: BrushFieldType | undefined;
  showSelectionListener: boolean;
};

export function useVegaCrossFilterOptions(
  cell: VegaCell,
): UseVegaCrossFilterOptionsParams {
  const selectedSqlId = cell.data.sqlId;

  const getCrossFilterPredicate = useCellsStore(
    (s) => s.cells.getCrossFilterPredicate,
  );

  const selectedSqlStatus = useCellsStore((s) =>
    selectedSqlId ? s.cells.status[selectedSqlId] : undefined,
  );

  const crossFilterEnabled = cell.data.crossFilter?.enabled !== false;
  const brushField = cell.data.crossFilter?.brushField ?? null;
  const brushFieldType = cell.data.crossFilter?.brushFieldType;

  const crossFilterPredicate =
    selectedSqlId && crossFilterEnabled
      ? getCrossFilterPredicate(cell.id, selectedSqlId)
      : null;

  const showSelectionListener = Boolean(
    crossFilterEnabled && brushField && selectedSqlStatus,
  );

  return {
    crossFilterEnabled,
    crossFilterPredicate,
    brushField,
    brushFieldType,
    showSelectionListener,
  };
}
