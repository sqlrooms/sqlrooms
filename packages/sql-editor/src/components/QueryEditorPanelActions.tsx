import {RunButton, Tooltip, TooltipContent, TooltipTrigger} from '@sqlrooms/ui';
import {isMacOS} from '@sqlrooms/utils';
import React from 'react';
import {useStoreWithSqlEditor} from '../SqlEditorSlice';

export const QueryEditorPanelActions: React.FC<{className?: string}> = ({
  className,
}) => {
  const runCurrentQuery = useStoreWithSqlEditor(
    (s) => s.sqlEditor.parseAndRunCurrentQuery,
  );
  const abortCurrentQuery = useStoreWithSqlEditor(
    (s) => s.sqlEditor.abortCurrentQuery,
  );
  const selectedQueryResult = useStoreWithSqlEditor((s) => {
    const selectedId = s.sqlEditor.config.selectedQueryId;
    return s.sqlEditor.queryResultsById[selectedId];
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
            onRun={runCurrentQuery}
            onCancel={abortCurrentQuery}
            variant="default"
            cancelVariant="default"
            className={className}
          />
        </div>
      </TooltipTrigger>
      <TooltipContent align="end">
        {isLoading
          ? 'Cancel the running query'
          : `Run query (${isMac ? 'Cmd' : 'Ctrl'}+Enter)`}
      </TooltipContent>
    </Tooltip>
  );
};
