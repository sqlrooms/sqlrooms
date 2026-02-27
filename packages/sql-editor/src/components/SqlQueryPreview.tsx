import {DataTablePaginated, useArrowDataTable} from '@sqlrooms/data-table';
import {makeLimitQuery, separateLastStatement, useSql} from '@sqlrooms/db';
import {cn} from '@sqlrooms/ui';
import {AlertCircle} from 'lucide-react';
import React, {useMemo, useState} from 'react';
import {QueryResultLimitSelect} from './QueryResultLimitSelect';

export interface SqlQueryPreviewProps {
  /**
   * The SQL query to preview
   */
  query: string;
  /**
   * Custom class name
   */
  className?: string;
  /**
   * Default limit for results
   * @default 100
   */
  defaultLimit?: number;
  /**
   * Options for the limit dropdown
   * @default [100, 500, 1000]
   */
  limitOptions?: number[];
}

/**
 * SQL query preview component with validation and results display.
 * Only allows single SELECT statements.
 * Displays results without pagination (just limited rows).
 */
export const SqlQueryPreview: React.FC<SqlQueryPreviewProps> = ({
  query,
  className,
  defaultLimit = 100,
  limitOptions = [100, 500, 1000],
}) => {
  const [limit, setLimit] = useState(defaultLimit);

  // Validate and prepare query
  const {limitedQuery, error} = useMemo(() => {
    if (!query.trim()) {
      return {limitedQuery: '', error: null};
    }

    const {precedingStatements, lastStatement} = separateLastStatement(query);

    // Only allow single statements
    if (precedingStatements.length > 0) {
      return {
        limitedQuery: '',
        error: 'Only single SELECT statements are allowed for preview',
      };
    }

    // Apply limit to the query
    const limited = makeLimitQuery(lastStatement, {
      limit,
      sanitize: true,
    });

    return {limitedQuery: limited, error: null};
  }, [query, limit]);

  // Execute query
  const queryResult = useSql({
    query: limitedQuery,
    enabled: !!limitedQuery,
  });

  const arrowTableData = useArrowDataTable(queryResult.data?.arrowTable);

  // Show error if validation failed
  if (error) {
    return (
      <div
        className={cn('flex items-center gap-2 p-3 text-red-500', className)}
      >
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span className="text-xs">{error}</span>
      </div>
    );
  }

  // Don't render if no query
  if (!limitedQuery) {
    return null;
  }

  // Show query error
  if (queryResult.error) {
    return (
      <div className={cn('p-3', className)}>
        <pre className="text-xs leading-tight text-red-500">
          {queryResult.error?.message ?? 'Unknown error'}
        </pre>
      </div>
    );
  }

  return (
    <div className={cn('flex h-full flex-col', className)}>
      <div className="min-h-0 flex-1 overflow-hidden">
        <DataTablePaginated
          {...arrowTableData}
          fontSize="text-xs"
          isFetching={queryResult.isLoading}
          footerActions={
            <QueryResultLimitSelect
              value={limit}
              onChange={setLimit}
              options={limitOptions}
            />
          }
        />
      </div>
    </div>
  );
};
