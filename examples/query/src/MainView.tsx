import {
  CreateTableModal,
  QueryEditorPanel,
  QueryResultPanel,
  SqlMonacoEditor,
} from '@sqlrooms/sql-editor';
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  useDisclosure,
} from '@sqlrooms/ui';
import {PlusIcon} from 'lucide-react';
import {FC, useState} from 'react';
import {useRoomStore} from './store';

export const MainView: FC = () => {
  const createTableModal = useDisclosure();
  const monacoModal = useDisclosure();
  const [monacoValue, setMonacoValue] = useState(
    'SELECT 1 AS hello, 2 AS world;',
  );
  const lastQuery = useRoomStore((s) => {
    const selectedId = s.sqlEditor.config.selectedQueryId;
    const qr = s.sqlEditor.queryResultsById[selectedId];
    return qr?.status === 'success' && qr?.type === 'select' ? qr.query : '';
  });
  return (
    <>
      <div className="flex h-full flex-col bg-muted">
        <Popover
          open={monacoModal.isOpen}
          onOpenChange={(open) =>
            open ? monacoModal.onOpen() : monacoModal.onClose()
          }
        >
          <PopoverTrigger asChild>
            <Button size="xs" variant="outline">
              Open Monaco
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="mt-20 w-[500px] max-w-[90vw] p-3"
            align="start"
          >
            <div className="mb-2 text-sm font-medium">Monaco editor</div>
            <div className="h-[500px] w-full overflow-hidden rounded-md border">
              <SqlMonacoEditor
                className="h-full"
                value={monacoValue}
                onChange={(v) => setMonacoValue(v ?? '')}
                options={{
                  minimap: {enabled: false},
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                }}
              />
            </div>
          </PopoverContent>
        </Popover>

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
        allowMultipleStatements={true}
        showSchemaSelection={true}
      />
    </>
  );
};
