import {useMemo} from 'react';
import type {DataTableExplorerStoreState} from '../createDataTableExplorerStore';
import type {DataTableExplorerColumnState} from '../types';
import {
  createEmptySummaryState,
  isDataTableExplorerHistogramType,
  isDataTableExplorerUnsupportedSummaryType,
} from '../utils';

export type UseDataTableExplorerColumnsOptions = {
  fields: DataTableExplorerStoreState['schema']['fields'];
  summaries: DataTableExplorerStoreState['summaries'];
};

/**
 * Maps the schema fields and summary state into the column model consumed by
 * the dataTableExplorer header and summary cells.
 */
export function useDataTableExplorerColumns({
  fields,
  summaries,
}: UseDataTableExplorerColumnsOptions): DataTableExplorerColumnState[] {
  return useMemo<DataTableExplorerColumnState[]>(
    () =>
      fields.map((field) => ({
        field,
        kind: isDataTableExplorerUnsupportedSummaryType(field.type)
          ? 'unsupported'
          : isDataTableExplorerHistogramType(field.type)
            ? 'histogram'
            : 'category',
        name: field.name,
        summary: summaries[field.name] ?? createEmptySummaryState(field),
      })),
    [fields, summaries],
  );
}
