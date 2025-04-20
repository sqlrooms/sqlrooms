import React, {useCallback, useState} from 'react';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@sqlrooms/ui';
import {useBaseProjectBuilderStore} from '@sqlrooms/project-builder';
import {SqlEditorHeader} from './components/SqlEditorHeader';
import {TableStructurePanel} from './components/TableStructurePanel';
import {QueryEditorPanel} from './components/QueryEditorPanel';
import {QueryResultPanel} from './components/QueryResultPanel';
import CreateTableModal from './CreateTableModal';
import DeleteSqlQueryModal from './DeleteSqlQueryModal';
import RenameSqlQueryModal from './RenameSqlQueryModal';
import {useStoreWithSqlEditor} from './SqlEditorSlice';

export type SqlEditorProps = {
  /** The database schema to use for queries. Defaults to 'main' */
  schema?: string;
  /** Whether the SQL editor is currently visible */
  isOpen: boolean;
  /** Optional component to render SQL documentation in the side panel */
  documentationPanel?: React.ReactNode;
  /** Callback fired when the SQL editor should be closed */
  onClose: () => void;
};

const SqlEditorBase: React.FC<SqlEditorProps> = (props) => {
  const {schema = 'main', documentationPanel} = props;

  // Store access
  const addOrUpdateSqlQueryDataSource = useBaseProjectBuilderStore(
    (state) => state.project.addOrUpdateSqlQueryDataSource,
  );
  const lastExecutedQuery = useStoreWithSqlEditor(
    (s) => s.config.sqlEditor.lastExecutedQuery,
  );
  const currentQuery = useStoreWithSqlEditor((s) =>
    s.sqlEditor.getCurrentQuery(''),
  );

  // UI state
  const [showDocs, setShowDocs] = useState(false);
  const [createTableModalOpen, setCreateTableModalOpen] = useState(false);
  const [queryToDelete, setQueryToDelete] = useState<string | null>(null);
  const [queryToRename, setQueryToRename] = useState<{
    id: string;
    name: string;
  } | null>(null);

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
      <div className="bg-muted h-full flex-grow">
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
                    <QueryEditorPanel schema={schema} />
                  </ResizablePanel>
                </ResizablePanelGroup>
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={50}>
                <QueryResultPanel
                  schema={schema}
                  onCreateTable={handleCreateTable}
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
        query={lastExecutedQuery || currentQuery}
        isOpen={createTableModalOpen}
        onClose={() => setCreateTableModalOpen(false)}
        onAddOrUpdateSqlQuery={addOrUpdateSqlQueryDataSource}
      />
      <DeleteSqlQueryModal
        isOpen={queryToDelete !== null}
        onClose={() => setQueryToDelete(null)}
        onConfirm={() => {
          if (queryToDelete) {
            setQueryToDelete(null);
          }
        }}
      />
      <RenameSqlQueryModal
        isOpen={queryToRename !== null}
        onClose={() => setQueryToRename(null)}
        initialName={queryToRename?.name ?? ''}
        onRename={(newName) => {
          if (queryToRename) {
            setQueryToRename(null);
          }
        }}
      />
    </div>
  );
};

// Wrap with React.memo to prevent unnecessary re-renders
const SqlEditor = React.memo(SqlEditorBase);

export default SqlEditor;
