import {DataTableModal} from '@sqlrooms/data-table';
import {Expand, TableIcon} from 'lucide-react';
import {useState} from 'react';

type ToolQueryProps = {
  title: string;
  sqlQuery: string;
};

export function ToolQuery({title, sqlQuery}: ToolQueryProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleClick = () => {
    setIsModalOpen(true);
  };

  const onClose = () => {
    setIsModalOpen(false);
  };

  return (
    <>
      <div
        className="flex gap-2 flex-row items-center text-muted-foreground"
        onClick={handleClick}
      >
        <TableIcon className="h-4 w-4" />
        <h3 className="ml-1 text-xs uppercase">Query Result</h3>
        <Expand className="h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-200" />
      </div>

      <DataTableModal
        title={title}
        query={sqlQuery}
        tableModal={{
          isOpen: isModalOpen,
          onClose: onClose,
        }}
      />
    </>
  );
}
