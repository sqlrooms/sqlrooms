import {escapeId} from '@sqlrooms/duckdb';
import {PaginationState, SortingState} from '@tanstack/table-core';

/**
 * Make a paged query from a query and pagination/sorting state.
 * @param query - The query to make paged.
 * @param sorting - The sorting state.
 * @param pagination - The pagination state.
 * @returns The paged query.
 */
export function makePagedQuery(
  query: string,
  sorting: SortingState,
  pagination: PaginationState,
) {
  return `SELECT * FROM (
    ${query}
    ) ${
      sorting.length > 0
        ? `ORDER BY ${sorting
            .map((d) => `${escapeId(d.id)}${d.desc ? ' DESC' : ''}`)
            .join(', ')}`
        : ''
    }
    OFFSET ${pagination.pageIndex * pagination.pageSize}
    LIMIT ${pagination.pageSize}`;
}

/**
 * Make a limit query from a query and a limit.
 * @param query - The SELECT query to make limited.
 * @param limit - The number of rows to limit the query to.
 * @returns The limited query.
 */
export function makeLimitQuery(query: string, limit: number = 100) {
  return `SELECT * FROM (
    ${query}
  ) LIMIT ${limit}`;
}
