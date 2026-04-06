import type {ToolRenderer, ToolRendererProps} from '@sqlrooms/ai-core';
import {
  type ArrowDataTableValueFormatter,
  DataTableModal,
} from '@sqlrooms/data-table';
import {Button, CopyButton, useDisclosure} from '@sqlrooms/ui';
import {TableIcon} from 'lucide-react';
import type {QueryToolOutput, QueryToolParameters} from './queryTool';

export type QueryToolRendererOptions = {
  /** Whether to show the SQL text in the result. Defaults to true. */
  showSql?: boolean;
  /** Optional custom value formatter for binary/geometry data */
  formatValue?: ArrowDataTableValueFormatter;
  /** Optional callback to open query in SQL editor tab */
  onOpenAsSqlEditorTab?: (sqlQuery: string, title: string) => void;
};

/**
 * Creates a configured renderer for query tool results.
 *
 * @example
 * ```ts
 * toolRenderers: {
 *   query: createQueryToolRenderer({
 *     showSql: false,
 *     formatValue: myGeomFormatter,
 *   }),
 * }
 * ```
 */
export function createQueryToolRenderer(
  options?: QueryToolRendererOptions,
): ToolRenderer<QueryToolOutput, QueryToolParameters> {
  const {showSql = true, formatValue, onOpenAsSqlEditorTab} = options ?? {};

  return function QueryToolResultRenderer({
    output,
    input,
  }: ToolRendererProps<QueryToolOutput, QueryToolParameters>) {
    const tableModal = useDisclosure();
    if (!output) return null;
    const sqlQuery = output.sqlQuery ?? input?.sqlQuery ?? '';
    const title = output.title ?? 'Query Result';
    const shouldShowSql = output.showSql ?? showSql;

    const handleOpenAsSqlEditorTab = onOpenAsSqlEditorTab
      ? () => {
          onOpenAsSqlEditorTab(sqlQuery, title);
          tableModal.onClose();
        }
      : undefined;

    return (
      <>
        {shouldShowSql && (
          <div className="text-muted-foreground group/sql bg-muted relative max-h-[150px] w-full overflow-auto rounded-md p-2 font-mono text-xs">
            <pre className="min-h-4 pr-8 wrap-break-word whitespace-pre-wrap">
              {sqlQuery}
            </pre>
            <div className="absolute top-1 right-1 opacity-0 transition-opacity group-focus-within/sql:opacity-100 group-hover/sql:opacity-100">
              <CopyButton
                text={sqlQuery}
                tooltipLabel="Copy SQL query"
                className="h-6 w-6"
              />
            </div>
          </div>
        )}
        {output.success === false ? (
          <div className="text-destructive bg-destructive/10 rounded-md p-2 text-xs">
            {output.error ?? output.details ?? 'Query execution failed.'}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
              <Button variant="ghost" size="xs" onClick={tableModal.onOpen}>
                <TableIcon className="h-4 w-4" />
                <h3 className="text-xs">Show Query Result</h3>
              </Button>
            </div>

            <DataTableModal
              title={title}
              query={sqlQuery}
              tableModal={tableModal}
              formatValue={formatValue}
              onOpenAsSqlEditorTab={handleOpenAsSqlEditorTab}
            />
          </>
        )}
      </>
    );
  };
}

/**
 * Default renderer for query tool results.
 * For custom configuration (showSql, formatValue) use {@link createQueryToolRenderer}.
 */
export const QueryToolResult = createQueryToolRenderer();
