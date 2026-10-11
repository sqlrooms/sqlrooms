import type {Table as ArrowTable} from 'apache-arrow';

export type SupportedTable = ArrowTable;

/**
 * Normalize supported table runtimes to Apache Arrow for deck preparation.
 *
 * `@sqlrooms/deck` uses Apache Arrow internally because GeoArrow integration
 * and the existing preparation pipeline depend on Arrow's `Table` / `Vector`
 * APIs. The public `arrowTable` dataset input is therefore Apache Arrow.
 */
export function toArrowTable(table: SupportedTable): ArrowTable {
  return table;
}
