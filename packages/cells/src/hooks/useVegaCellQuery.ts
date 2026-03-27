import {useCellsStore} from '../hooks';

export type VegaCellQuery = {
  selectedSqlQuery: string;
  crossFilterPredicate: string | null;
};

/**
 * Builds the final SQL query for a Vega cell with optional cross-filter predicates.
 * If cross-filtering is enabled and active, wraps the base query as a subquery
 * and applies the WHERE clause to avoid breaking raw SQL with existing clauses.
 */
export function useVegaCellQuery(params: {
  cellId: string;
  baseSqlQuery: string;
  selectedSqlId: string | undefined;
  crossFilterEnabled: boolean;
}): VegaCellQuery {
  const {cellId, baseSqlQuery, selectedSqlId, crossFilterEnabled} = params;

  const getCrossFilterPredicate = useCellsStore(
    (s) => s.cells.getCrossFilterPredicate,
  );

  // Subscribe to cross-filter selections so we re-render when siblings change
  const crossFilterGroup = useCellsStore((s) =>
    selectedSqlId ? s.cells.crossFilterSelections[selectedSqlId] : undefined,
  );
  // Needed to satisfy exhaustive-deps for the memoized predicate
  void crossFilterGroup;

  const crossFilterPredicate =
    selectedSqlId && crossFilterEnabled
      ? getCrossFilterPredicate(cellId, selectedSqlId)
      : null;

  const selectedSqlQuery = crossFilterPredicate
    ? `SELECT * FROM (${baseSqlQuery.replace(/;\s*$/, '')}) AS _cells_base WHERE ${crossFilterPredicate}`
    : baseSqlQuery;

  return {
    selectedSqlQuery,
    crossFilterPredicate,
  };
}
