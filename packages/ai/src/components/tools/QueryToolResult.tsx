import {DataTableModal} from '@sqlrooms/data-table';
import {Button, CopyButton, useDisclosure} from '@sqlrooms/ui';
import {TableIcon} from 'lucide-react';

type QueryToolResultProps = {
  title: string;
  sqlQuery: string;
};

export function QueryToolResult({title, sqlQuery}: QueryToolResultProps) {
  const tableModal = useDisclosure();
  return (
    <>
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
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={tableModal.onOpen}>
          <TableIcon className="h-4 w-4" />
          <h3 className="ml-1 text-xs">Show Query Result</h3>
        </Button>
      </div>

      <DataTableModal title={title} query={sqlQuery} tableModal={tableModal} />
    </>
  );
}
