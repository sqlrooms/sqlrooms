export type VegaCellQuery = {
  selectedSqlQuery: string;
};

/**
 * Builds the final SQL query for a Vega cell with optional cross-filter predicates.
 * If cross-filtering is enabled and active, wraps the base query as a subquery
 * and applies the WHERE clause to avoid breaking raw SQL with existing clauses.
 */
export function useVegaCellQuery(params: {
  baseSqlQuery: string;
}): VegaCellQuery {
  const {baseSqlQuery} = params;

  return {
    selectedSqlQuery: baseSqlQuery,
  };
}
