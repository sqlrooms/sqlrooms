import {DataTableModal, ArrowDataTableValueFormatter} from '@sqlrooms/data-table';
import {Button, CopyButton, useDisclosure} from '@sqlrooms/ui';
import * as arrow from 'apache-arrow';
import {TableIcon} from 'lucide-react';

type QueryToolResultProps = {
  title: string;
  sqlQuery: string;
  /** Provided in case the query result is already an arrow table */
  arrowTable?: arrow.Table;
  /** Whether to show the SQL text in the result */
  showSql?: boolean;
  /** Optional custom value formatter for binary/geometry data */
  formatValue?: ArrowDataTableValueFormatter;
};

export function QueryToolResult(props: QueryToolResultProps) {
  const {title, sqlQuery, showSql = true, formatValue} = props;
  const tableModal = useDisclosure();
  return (
    <>
      {showSql && (
        <div className="text-muted-foreground bg-muted relative max-h-[150px] w-full overflow-auto rounded-md p-2 font-mono text-xs">
          <pre className="whitespace-pre-wrap break-words pr-8">{sqlQuery}</pre>
          <div className="absolute right-1 top-1">
            <CopyButton
              text={sqlQuery}
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              ariaLabel="Copy SQL"
            />
          </div>
        </div>
      )}
      <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
        <Button variant="ghost" size="xs" onClick={tableModal.onOpen}>
          <TableIcon className="h-4 w-4" />
          <h3 className="text-xs">Show Query Result</h3>
        </Button>
      </div>

      {'arrowTable' in props ? (
        props.arrowTable ? (
          <DataTableModal
            title={title}
            arrowTable={props.arrowTable}
            tableModal={tableModal}
            formatValue={formatValue}
          />
        ) : (
          <div className="p-4 text-xs">No data</div>
        )
      ) : (
        <DataTableModal
          title={title}
          query={sqlQuery}
          tableModal={tableModal}
          formatValue={formatValue}
        />
      )}
    </>
  );
}
