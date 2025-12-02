import {
  CreateTableModal,
  QueryEditorPanel,
  QueryResultPanel,
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
  const lastQuery = useRoomStore(({sqlEditor: {queryResult: qr}}) =>
    qr?.status === 'success' && qr?.type === 'select' ? qr.query : '',
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
        query={lastQuery}
        isOpen={createTableModal.isOpen}
        onClose={createTableModal.onClose}
      />
    </>
  );
};
