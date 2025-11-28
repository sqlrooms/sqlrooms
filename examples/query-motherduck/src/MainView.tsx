import {
  CreateTableModal,
  QueryEditorPanel,
  QueryResultPanel,
  SqlReferenceButton,
} from '@sqlrooms/sql-editor';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  useDisclosure,
} from '@sqlrooms/ui';
import {PlusIcon, XCircleIcon} from 'lucide-react';
import {FC} from 'react';
import {MD_TOKEN_KEY} from './App';
import {useRoomStore} from './store';

export const MainView: FC = () => {
  const createTableModal = useDisclosure();
  const confirmClearTokenModal = useDisclosure();

  const lastQueryStatement = useRoomStore((s) =>
    s.sqlEditor.queryResult?.status === 'success' &&
    s.sqlEditor.queryResult?.type === 'select'
      ? s.sqlEditor.queryResult.lastQueryStatement
      : '',
  );
  const addOrUpdateSqlQueryDataSource = useRoomStore(
    (state) => state.room.addOrUpdateSqlQueryDataSource,
  );

  const handleClearToken = () => {
    localStorage.removeItem(MD_TOKEN_KEY);
    window.location.reload();
  };

  return (
    <>
      <div className="bg-muted flex h-full flex-col">
        <div className="bg-background flex items-center justify-end gap-2 pb-2">
          <Button
            variant="ghost"
            size="xs"
            className="h-8"
            onClick={confirmClearTokenModal.onOpen}
          >
            Forget MotherDuck token
            <XCircleIcon className="h-4 w-4" />
          </Button>
          <SqlReferenceButton
            variant="ghost"
            className="h-8"
            url="https://motherduck.com/docs/sql-reference/"
          />
        </div>
        <ResizablePanelGroup direction="vertical">
          <ResizablePanel
            defaultSize={50}
            // this is for Monaco's completion menu to not being cut off
            // className="!overflow-visible"
          >
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

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmClearTokenModal.isOpen}
        onOpenChange={confirmClearTokenModal.onClose}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear MotherDuck Token</DialogTitle>
            <DialogDescription>
              Are you sure you want to clear your saved MotherDuck token? You
              will need to reconnect to MotherDuck after this action.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={confirmClearTokenModal.onClose}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleClearToken}>
              Clear Token
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateTableModal
        query={lastQueryStatement ?? ''}
        isOpen={createTableModal.isOpen}
        onClose={createTableModal.onClose}
        onAddOrUpdateSqlQuery={addOrUpdateSqlQueryDataSource}
      />
    </>
  );
};
