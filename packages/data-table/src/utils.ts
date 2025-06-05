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
