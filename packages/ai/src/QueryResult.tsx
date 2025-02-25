import {CustomFunctionCall} from '@openassistant/core';
import {DataTableModal} from '@sqlrooms/data-table';
import {Expand, TableIcon} from 'lucide-react';
import {useState} from 'react';

/**
 * A modal component that displays a data table with a title.
 *
 * @component
 * @param {Object} props - The component props
 * @param {string} props.title - The title to display in the modal header
 * @param {string} props.sqlQuery - The SQL query that generated the data
 * @returns {JSX.Element} A modal component containing a data table
 */
function QueryResultTableModal({
  title,
  sqlQuery,
}: {
  title: string;
  sqlQuery: string;
}) {
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

type QueryToolOutputData = {
  sqlQuery: string;
};

function isQueryToolOutputData(data: unknown): data is QueryToolOutputData {
  return typeof data === 'object' && data !== null && 'sqlQuery' in data;
}
/**
 * Creates a query result message component based on a custom function call.
 *
 * @param {CustomFunctionCall} props - The custom function call properties
 * @returns {JSX.Element | null} A query result table modal component or null if no data is available
 */
export function queryMessage(props: CustomFunctionCall) {
  const data = props.output?.data;

  if (!isQueryToolOutputData(data)) {
    throw new Error('Invalid query tool output data');
  }
  if (!data.sqlQuery) {
    return null;
  }

  return (
    <QueryResultTableModal title={data.sqlQuery} sqlQuery={data.sqlQuery} />
  );
}
