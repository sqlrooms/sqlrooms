import type {DataTableExplorerStoreState} from '../createDataTableExplorerStore';

export type UseDataTableExplorerStatusOptions = {
  filteredCount: DataTableExplorerStoreState['filteredCount'];
  page: DataTableExplorerStoreState['page'];
  schema: DataTableExplorerStoreState['schema'];
  summaries: DataTableExplorerStoreState['summaries'];
  totalCount: DataTableExplorerStoreState['totalCount'];
};

export type UseDataTableExplorerStatusReturn = {
  isLoading: boolean;
  tableError?: Error;
};

/**
 * Collapses the aggregated dataTableExplorer client state into the loading and error
 * signals exposed from the public hook.
 */
export function useDataTableExplorerStatus(
  options: UseDataTableExplorerStatusOptions,
): UseDataTableExplorerStatusReturn {
  const {filteredCount, page, schema, summaries, totalCount} = options;
  const hasPendingSummaryInitialization =
    schema.fields.length > 0 &&
    Object.keys(summaries).length < schema.fields.length;

  return {
    isLoading:
      schema.isLoading ||
      page.isLoading ||
      filteredCount.isLoading ||
      totalCount.isLoading ||
      hasPendingSummaryInitialization ||
      Object.values(summaries).some((summary) => summary.isLoading),
    tableError:
      schema.error ??
      page.error ??
      filteredCount.error ??
      totalCount.error ??
      Object.values(summaries).find((summary) => summary.error)?.error,
  };
}
