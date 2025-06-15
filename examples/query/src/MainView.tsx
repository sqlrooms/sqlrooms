import {
  CreateTableModal,
  QueryEditorPanel,
  QueryResultPanel,
  SqlReferenceButton,
} from '@sqlrooms/sql-editor';
import {
  Button,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  useDisclosure,
} from '@sqlrooms/ui';
import {PlusIcon} from 'lucide-react';
import {FC} from 'react';
import {useRoomStore} from './store';

export const MainView: FC = () => {
  const createTableModal = useDisclosure();
  const lastQueryStatement = useRoomStore((s) =>
    s.sqlEditor.queryResult?.status === 'success' &&
    s.sqlEditor.queryResult?.type === 'select'
      ? s.sqlEditor.queryResult.lastQueryStatement
      : '',
  );
  const addOrUpdateSqlQueryDataSource = useRoomStore(
    (state) => state.room.addOrUpdateSqlQueryDataSource,
  );
  return (
    <>
      <div className="bg-muted flex h-full flex-col">
        <ResizablePanelGroup direction="vertical">
          <ResizablePanel defaultSize={50}>
            <QueryEditorPanel />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={50}>
            <QueryResultPanel
              renderActions={() => (
                <div className="flex gap-2">
                  <Button size="xs" onClick={createTableModal.onToggle}>
                    <PlusIcon className="h-4 w-4" />
                    New table
                  </Button>
                </div>
              )}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      <CreateTableModal
        query={lastQueryStatement ?? ''}
        isOpen={createTableModal.isOpen}
        onClose={createTableModal.onClose}
        onAddOrUpdateSqlQuery={addOrUpdateSqlQueryDataSource}
      />
    </>
  );
};
