import React from 'react';
import {cn, Tabs, TabsContent} from '@sqlrooms/ui';
import {useStoreWithSqlEditor} from '../SqlEditorSlice';
import {QueryEditorPanelActions} from './QueryEditorPanelActions';
import {QueryEditorPanelEditor} from './QueryEditorPanelEditor';
import {QueryEditorPanelTabsList} from './QueryEditorPanelTabsList';

export interface QueryEditorPanelProps {
  /** Custom class name for styling */
  className?: string;
}

export const QueryEditorPanel: React.FC<QueryEditorPanelProps> = ({
  className,
}) => {
  // Get state and actions from store in a single call

  const selectedQueryId = useStoreWithSqlEditor(
    (s) => s.sqlEditor.config.selectedQueryId,
  );
  const queries = useStoreWithSqlEditor((s) => s.sqlEditor.config.queries);
  const setSelectedQueryId = useStoreWithSqlEditor(
    (s) => s.sqlEditor.setSelectedQueryId,
  );

  return (
    <Tabs
      value={selectedQueryId}
      onValueChange={setSelectedQueryId}
      className={cn(
        'flex h-full flex-col',
        // this is for Monaco's completion menu to not being cut off
        'overflow-visible',
        className,
      )}
    >
      <div className="border-border flex items-center gap-4 border-b px-2 pt-1">
        <QueryEditorPanelTabsList />
        <div className="flex-1" />
        <QueryEditorPanelActions />
      </div>
      {queries.map((q) => (
        <TabsContent
          key={q.id}
          value={q.id}
          className="relative h-full flex-grow flex-col data-[state=active]:flex"
        >
          <div className="absolute inset-0 h-full w-full flex-grow">
            {q.id === selectedQueryId && (
              <QueryEditorPanelEditor queryId={q.id} />
            )}
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
};
