import {
  Button,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@sqlrooms/ui';
import {PlusIcon} from 'lucide-react';
import React, {useCallback, useState} from 'react';
import CreateTableModal from './components/CreateTableModal';
import {QueryEditorPanel} from './components/QueryEditorPanel';
import {QueryResultPanel} from './components/QueryResultPanel';
import {SqlEditorHeader} from './components/SqlEditorHeader';
import {
  TableStructurePanel,
  TableStructurePanelProps,
} from './components/TableStructurePanel';
import {useStoreWithSqlEditor} from './SqlEditorSlice';

export type SqlEditorProps = {
  /** The database schema to use. Defaults to '*'.
   * If '*' is provided, all tables will be shown.
   * If a function is provided, it will be used to filter the tables. */
  schema?: TableStructurePanelProps['schema'];
  /** Whether the SQL editor is currently visible */
  isOpen: boolean;
  /** Optional component to render SQL documentation in the side panel */
  documentationPanel?: React.ReactNode;
  /**
   * Props forwarded to `QueryResultPanel` to configure result behavior.
   * This provides a single entry point for table interactions.
   */
  queryResultProps?: Pick<
    React.ComponentProps<typeof QueryResultPanel>,
    'onRowClick' | 'onRowDoubleClick'
  >;
  /** Callback fired when the SQL editor should be closed */
  onClose: () => void;
};

const SqlEditor = React.memo<SqlEditorProps>((props) => {
  const {schema = '*', documentationPanel, queryResultProps} = props;

  const lastQuery = useStoreWithSqlEditor((s) => {
    const selectedId = s.sqlEditor.config.selectedQueryId;
    const qr = s.sqlEditor.queryResultsById[selectedId];
    if (qr?.status === 'success' && qr?.type === 'select') return qr.query;
    return s.sqlEditor.getCurrentQuery();
  });
  // UI state
  const [showDocs, setShowDocs] = useState(false);
  const [createTableModalOpen, setCreateTableModalOpen] = useState(false);

  // Handlers
  const handleToggleDocs = useCallback((show: boolean) => {
    setShowDocs(show);
  }, []);

  const handleCreateTable = useCallback(() => {
    setCreateTableModalOpen(true);
  }, []);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      <SqlEditorHeader
        title="SQL Editor"
        showDocs={showDocs}
        documentationPanel={documentationPanel}
        onToggleDocs={handleToggleDocs}
      />
      <div className="bg-muted h-full grow">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          <ResizablePanel defaultSize={showDocs ? 70 : 100}>
            <ResizablePanelGroup direction="vertical" className="h-full">
              <ResizablePanel defaultSize={50} className="flex flex-row">
                <ResizablePanelGroup direction="horizontal">
                  <ResizablePanel defaultSize={20}>
                    <TableStructurePanel schema={schema} />
                  </ResizablePanel>
                  <ResizableHandle withHandle />
                  <ResizablePanel defaultSize={80}>
                    <QueryEditorPanel />
                  </ResizablePanel>
                </ResizablePanelGroup>
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={50}>
                <QueryResultPanel
                  onRowClick={queryResultProps?.onRowClick}
                  onRowDoubleClick={queryResultProps?.onRowDoubleClick}
                  renderActions={() => (
                    <div className="flex gap-2">
                      <Button size="xs" onClick={handleCreateTable}>
                        <PlusIcon className="h-4 w-4" />
                        New table
                      </Button>
                    </div>
                  )}
                />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
          {showDocs && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={30}>
                {documentationPanel}
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
      <CreateTableModal
        query={lastQuery}
        isOpen={createTableModalOpen}
        onClose={() => setCreateTableModalOpen(false)}
        allowMultipleStatements={true}
        showSchemaSelection={true}
      />
    </div>
  );
});
SqlEditor.displayName = 'SqlEditor';

export default SqlEditor;
