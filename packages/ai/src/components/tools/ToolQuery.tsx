import {DataTableModal} from '@sqlrooms/data-table';
import {Button, useDisclosure} from '@sqlrooms/ui';
import {TableIcon} from 'lucide-react';

type ToolQueryProps = {
  title: string;
  sqlQuery: string;
};

export function ToolQuery({title, sqlQuery}: ToolQueryProps) {
  const tableModal = useDisclosure();
  return (
    <>
      <div className="text-muted-foreground bg-muted max-h-20 w-full overflow-auto whitespace-pre-wrap rounded-md p-2 font-mono text-xs">
        {sqlQuery}
      </div>
      <div>
        <Button variant="ghost" size="sm" onClick={tableModal.onOpen}>
          <TableIcon className="h-4 w-4" />
          <h3 className="ml-1 text-xs">Show Query Result</h3>
        </Button>
      </div>

      <DataTableModal title={title} query={sqlQuery} tableModal={tableModal} />
    </>
  );
}
