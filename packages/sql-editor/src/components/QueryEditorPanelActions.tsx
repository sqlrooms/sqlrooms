import {
  Button,
  cn,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@sqlrooms/ui';
import {PlayIcon} from 'lucide-react';
import React from 'react';
import {isMacOS} from '@sqlrooms/utils';
import {useStoreWithSqlEditor} from '../SqlEditorSlice';

export const QueryEditorPanelActions: React.FC<{className?: string}> = ({
  className,
}) => {
  const runCurrentQuery = useStoreWithSqlEditor(
    (s) => s.sqlEditor.runCurrentQuery,
  );
  const isMac = isMacOS();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="default"
          size="xs"
          onClick={() => runCurrentQuery()}
          className={cn('gap-2', className)}
        >
          <PlayIcon className="h-3 w-3" />
          <span>Run</span>
          <span>{isMac ? '⌘↵' : '⌃↵'}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        Use {isMac ? 'Cmd' : 'Ctrl'}+Enter to run query or selected text
      </TooltipContent>
    </Tooltip>
  );
};
