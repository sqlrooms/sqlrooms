import {
  Button,
  cn,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@sqlrooms/ui';
import {isMacOS} from '@sqlrooms/utils';
import {Loader2, OctagonXIcon} from 'lucide-react';
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
    icon?: React.ReactNode;
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
        text: 'Run',
        disabled: false,
      };
    }
  };

  const buttonContent = getButtonContent();

  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        <Button
          className={cn(
            'flex h-6 items-center justify-center gap-2 px-4',
            className,
          )}
          variant="default"
          size="xs"
          onClick={handleClick}
          disabled={buttonContent.disabled}
        >
          {buttonContent?.icon}
          <span>{buttonContent.text}</span>
          {buttonContent.rightIcon}
        </Button>
      </TooltipTrigger>
      <TooltipContent align="end">
        {isLoading
          ? 'Cancel the running query'
          : `Run query (${isMac ? 'Cmd' : 'Ctrl'}+Enter)`}
      </TooltipContent>
    </Tooltip>
  );
};
