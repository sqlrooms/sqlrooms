import {RunButton, Tooltip, TooltipContent, TooltipTrigger} from '@sqlrooms/ui';
import {isMacOS} from '@sqlrooms/utils';
import React from 'react';
import {useStoreWithSqlEditor} from '../SqlEditorSlice';

export const QueryEditorPanelActions: React.FC<{
  className?: string;
  queryId?: string;
}> = ({className, queryId}) => {
  const runCurrentQuery = useStoreWithSqlEditor(
    (s) => s.sqlEditor.parseAndRunCurrentQuery,
  );
  const abortCurrentQuery = useStoreWithSqlEditor(
    (s) => s.sqlEditor.abortCurrentQuery,
  );
  const runQueryById = useStoreWithSqlEditor((s) => s.sqlEditor.runQueryById);
  const abortQueryById = useStoreWithSqlEditor(
    (s) => s.sqlEditor.abortQueryById,
  );
  const selectedQueryId = useStoreWithSqlEditor(
    (s) => s.sqlEditor.config.selectedQueryId,
  );
  const selectedQueryResult = useStoreWithSqlEditor((s) => {
    const resolvedQueryId = queryId ?? s.sqlEditor.config.selectedQueryId;
    return s.sqlEditor.queryResultsById[resolvedQueryId];
  });
  const isMac = isMacOS();

  const isLoading = selectedQueryResult?.status === 'loading';
  const isAborted =
    selectedQueryResult?.status === 'loading' &&
    selectedQueryResult.isBeingAborted;

  const state = isAborted ? 'cancelling' : isLoading ? 'running' : 'idle';

  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        <div>
          <RunButton
            state={state}
            onRun={
              queryId
                ? () => runQueryById(queryId)
                : () => runCurrentQuery()
            }
            onCancel={
              queryId
                ? () => abortQueryById(queryId)
                : () => abortCurrentQuery()
            }
            variant="default"
            cancelVariant="default"
            className={className}
          />
        </div>
      </TooltipTrigger>
      <TooltipContent align="end">
        {isLoading
          ? 'Cancel the running query'
          : `Run ${
              queryId && queryId !== selectedQueryId ? 'this ' : ''
            }query (${isMac ? 'Cmd' : 'Ctrl'}+Enter)`}
      </TooltipContent>
    </Tooltip>
  );
};
