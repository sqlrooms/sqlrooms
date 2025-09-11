import {useBaseRoomShellStore} from '@sqlrooms/room-shell';
import {CreateTableModal} from '@sqlrooms/sql-editor';
import {Button} from '@sqlrooms/ui';
import {PlusIcon} from 'lucide-react';
import {useState} from 'react';

export const AddSqlCellResultToNewTable: React.FC<{
  query: string;
}> = ({query}) => {
  const [createTableModalOpen, setCreateTableModalOpen] = useState(false);
  const addOrUpdateSqlQueryDataSource = useBaseRoomShellStore(
    (state) => state.room.addOrUpdateSqlQueryDataSource,
  );
  console.log(query);
  return (
    <>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="xs"
          onClick={() => setCreateTableModalOpen(true)}
        >
          <PlusIcon className="h-4 w-4" />
          New table
        </Button>
      </div>
      <CreateTableModal
        query={query}
        isOpen={createTableModalOpen}
        onClose={() => setCreateTableModalOpen(false)}
        onAddOrUpdateSqlQuery={addOrUpdateSqlQueryDataSource}
      />
    </>
  );
};
