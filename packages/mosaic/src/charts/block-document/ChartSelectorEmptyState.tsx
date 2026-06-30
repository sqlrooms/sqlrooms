import type {DataTable} from '@sqlrooms/db';
import {FC} from 'react';
import {DataTableSelectorEmptyState} from '../../components/DataTableSelector';

type ChartSelectorEmptyStateProps = {
  disabled?: boolean;
  onChange?: (table: DataTable) => void;
  tables: DataTable[];
  value?: DataTable;
};

/**
 * Empty state selector for chart blocks.
 * Wraps DataTableSelectorEmptyState for consistency.
 */
export const ChartSelectorEmptyState: FC<ChartSelectorEmptyStateProps> = (
  props,
) => {
  return <DataTableSelectorEmptyState {...props} />;
};
