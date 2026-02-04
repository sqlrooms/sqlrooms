import React from 'react';
import {cn} from '@sqlrooms/ui';
import {useStoreWithSqlEditor} from '../SqlEditorSlice';
import {QueryEditorPanelActions} from './QueryEditorPanelActions';
import {QueryEditorPanelEditor} from './QueryEditorPanelEditor';
import {QueryEditorPanelTabsList} from './QueryEditorPanelTabsList';

export interface QueryEditorPanelProps {
  className?: string;
}

export const QueryEditorPanel: React.FC<QueryEditorPanelProps> = ({
  className,
}) => {
  const selectedQueryId = useStoreWithSqlEditor(
    (s) => s.sqlEditor.config.selectedQueryId,
  );
  const openTabs = useStoreWithSqlEditor((s) => s.sqlEditor.config.openTabs);

  const isSelectedOpen = openTabs.includes(selectedQueryId);

  // Keep all editors mounted, but hide inactive ones
  return (
    <div className={cn('flex h-full flex-col overflow-visible', className)}>
      <div className="border-border flex items-center gap-4 border-b px-2 pt-1">
        <QueryEditorPanelTabsList />
        <div className="flex-1" />
        <QueryEditorPanelActions />
      </div>

      {isSelectedOpen ? (
        <div className="bg-background h-full w-full py-1">
          <div className="relative h-full flex-grow">
            <div className="absolute inset-0">
              {openTabs.map((queryId) => {
                const isSelected = queryId === selectedQueryId;
                return (
                  <div
                    key={queryId}
                    className={cn(
                      'absolute inset-0 transition-opacity duration-100',
                      isSelected
                        ? 'opacity-100'
                        : 'pointer-events-none opacity-0',
                    )}
                    aria-hidden={!isSelected}
                    {...(!isSelected ? {inert: true} : null)}
                  >
                    <QueryEditorPanelEditor queryId={queryId} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
          No open queries
        </div>
      )}
    </div>
  );
};
