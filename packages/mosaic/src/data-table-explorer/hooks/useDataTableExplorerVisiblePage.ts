import {useDebounce} from '@sqlrooms/ui';
import type {Table} from 'apache-arrow';
import type {DataTableExplorerStoreState} from '../createDataTableExplorerStore';

export type UseDataTableExplorerVisiblePageOptions = {
  lastNonEmptyPageTable: DataTableExplorerStoreState['lastNonEmptyPageTable'];
  pageDatasetId: string;
  page: DataTableExplorerStoreState['page'];
  rowSelectionVersion: number;
  selectionVersion: number;
};

/**
 * Keeps the last non-empty page result visible while live brushing has moved
 * ahead of the deferred row query, avoiding transient "No rows" flashes.
 */
export function useDataTableExplorerVisiblePage(
  options: UseDataTableExplorerVisiblePageOptions,
): Table | undefined {
  const {
    lastNonEmptyPageTable,
    page,
    pageDatasetId,
    rowSelectionVersion,
    selectionVersion,
  } = options;
  const isRowDisplayStale = selectionVersion !== rowSelectionVersion;
  const hasCurrentRows = !!page.pageTable && page.pageTable.numRows > 0;
  const canReuseLastNonEmptyPage =
    !!lastNonEmptyPageTable &&
    lastNonEmptyPageTable.datasetId === pageDatasetId;
  const canShowStableEmpty =
    !page.isLoading &&
    !isRowDisplayStale &&
    (!page.pageTable || page.pageTable.numRows === 0);
  const showStableEmpty = useDebounce(canShowStableEmpty, 120);

  if (hasCurrentRows || !canReuseLastNonEmptyPage) {
    return page.pageTable;
  }

  return showStableEmpty ? page.pageTable : lastNonEmptyPageTable.pageTable;
}
