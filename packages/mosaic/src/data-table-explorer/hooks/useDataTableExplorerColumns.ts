import {useMemo} from 'react';
import type {DataTableExplorerStoreState} from '../createDataTableExplorerStore';
import type {
  DataTableExplorerColumnKind,
  DataTableExplorerColumnState,
} from '../types';
import {
  createEmptySummaryState,
  resolveDataTableExplorerColumnKind,
} from '../utils';

export type UseDataTableExplorerColumnsOptions = {
  /**
   * Resolved summary kind per field name. Fields missing from the map fall
   * back to the Arrow-type-driven default.
   */
  columnKinds?: Record<string, DataTableExplorerColumnKind>;
  fields: DataTableExplorerStoreState['schema']['fields'];
  summaries: DataTableExplorerStoreState['summaries'];
};

/**
 * Maps the schema fields and summary state into the column model consumed by
 * the dataTableExplorer header and summary cells.
 */
export function useDataTableExplorerColumns({
  columnKinds,
  fields,
  summaries,
}: UseDataTableExplorerColumnsOptions): DataTableExplorerColumnState[] {
  return useMemo<DataTableExplorerColumnState[]>(
    () =>
      fields.map((field) => {
        const kind =
          columnKinds?.[field.name] ??
          resolveDataTableExplorerColumnKind(field);
        return {
          field,
          kind,
          name: field.name,
          summary:
            summaries[field.name] ?? createEmptySummaryState(field, kind),
        };
      }),
    [columnKinds, fields, summaries],
  );
}
