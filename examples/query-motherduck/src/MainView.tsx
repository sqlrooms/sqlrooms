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
  Input,
} from '@sqlrooms/ui';
import {PlusIcon, KeyIcon} from 'lucide-react';
import {FC} from 'react';
import {useRoomStore} from './store';

export const MainView: FC = () => {
  const createTableModal = useDisclosure();
  const motherDuckToken = useRoomStore(
    (s) => s.motherDuckToken || s.config.motherDuckToken || '',
  );
  const setMotherDuckToken = useRoomStore((s) => s.setMotherDuckToken);
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
      {/* MotherDuck Token Input */}
      <div className="flex items-center gap-2 p-4 pb-0">
        <div className="relative flex items-center">
          <KeyIcon className="absolute left-2 h-4 w-4" />
          <Input
            className="w-[260px] pl-8"
            type="password"
            placeholder="MotherDuck Token"
            value={motherDuckToken}
            onChange={(e) => setMotherDuckToken(e.target.value)}
            autoComplete="off"
          />
        </div>
      </div>
      {/* Main panels */}
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
