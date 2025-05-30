import {
  Button,
  cn,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@sqlrooms/ui';
import {isMacOS} from '@sqlrooms/utils';
import {Loader2, OctagonXIcon, PlayIcon} from 'lucide-react';
import React from 'react';
import {useStoreWithSqlEditor} from '../SqlEditorSlice';

export const QueryEditorPanelActions: React.FC<{className?: string}> = ({
  className,
}) => {
  const runCurrentQuery = useStoreWithSqlEditor(
    (s) => s.sqlEditor.runCurrentQuery,
  );
  const abortCurrentQuery = useStoreWithSqlEditor(
    (s) => s.sqlEditor.abortCurrentQuery,
  );
  const queryResult = useStoreWithSqlEditor((s) => s.sqlEditor.queryResult);
  const isMac = isMacOS();

  const isLoading = queryResult?.status === 'loading';
  const isAborted =
    queryResult?.status === 'loading' && queryResult.isBeingAborted;

  const handleClick = () => {
    if (isLoading) {
      abortCurrentQuery();
    } else {
      runCurrentQuery();
    }
  };

  const getButtonContent = (): {
    icon: React.ReactNode;
    text: string;
    disabled: boolean;
    rightIcon?: React.ReactNode;
  } => {
    if (isLoading) {
      if (isAborted) {
        return {
          icon: <Loader2 className="h-3 w-3 animate-spin" />,
          text: 'Cancelling...',
          disabled: true,
        };
      } else {
        return {
          icon: <Loader2 className="h-3 w-3 animate-spin" />,
          text: 'Cancel',
          disabled: false,
          rightIcon: <OctagonXIcon className="h-3 w-3" />,
        };
      }
    } else {
      return {
        icon: <PlayIcon className="h-3 w-3" />,
        text: 'Run',
        disabled: false,
        rightIcon: <span>{isMac ? '⌘↵' : '⌃↵'}</span>,
      };
    }
  };

  const buttonContent = getButtonContent();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          className={cn('flex w-[110px] items-center gap-2', className)}
          variant={'outline'}
          size="xs"
          onClick={handleClick}
          disabled={buttonContent.disabled}
        >
          {buttonContent.icon}
          <span>{buttonContent.text}</span>
          {buttonContent.rightIcon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {isLoading
          ? 'Cancel the running query'
          : `Use ${isMac ? 'Cmd' : 'Ctrl'}+Enter to run query or selected text`}
      </TooltipContent>
    </Tooltip>
  );
};
