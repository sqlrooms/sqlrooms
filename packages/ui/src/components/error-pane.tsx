import {Alert, AlertDescription, AlertTitle} from './alert';
import {RotateCcwIcon, TriangleAlertIcon} from 'lucide-react';
import * as React from 'react';
import {cn} from '../lib/utils';
import {Button} from './button';

interface ErrorPaneProps extends React.HTMLAttributes<HTMLDivElement> {
  embed?: boolean;
  error?: string | Error | unknown;
  title?: string;
  text?: string;
  onRetry?: () => void;
  onGoToStart?: () => void;
  actions?: boolean;
}

const ErrorPane = React.forwardRef<HTMLDivElement, ErrorPaneProps>(
  (
    {
      className,
      embed,
      title = 'Something went wrong',
      text = `We are sorry, but something unexpected happened. We were notified
              and will be working on resolving the issue as soon as possible.`,
      onRetry,
      actions = false,
      onGoToStart,
      ...props
    },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className={cn('flex justify-center', className)}
        {...props}
      >
        <Alert
          variant="destructive"
          className={cn(
            'flex min-h-[200px] max-w-[450px] flex-col items-center justify-center rounded-lg bg-gray-700 px-6 py-6 text-center',
            !embed && 'min-w-[350px]',
          )}
        >
          <div className="mb-4">
            <TriangleAlertIcon className="h-8 w-8 text-destructive" />
          </div>
          <AlertTitle className="mb-1 text-xl">{title}</AlertTitle>
          <AlertDescription className="mt-3 max-w-sm px-2">
            <p className="mb-5 text-left">{text}</p>
            {actions && (
              <div className="mt-6 mb-3">
                <div className="flex justify-center gap-2">
                  {onRetry && (
                    <Button
                      size="sm"
                      onClick={onRetry}
                      className="inline-flex items-center"
                    >
                      <RotateCcwIcon className="mr-2 h-4 w-4" />
                      Retry
                    </Button>
                  )}
                  {!embed && onGoToStart && (
                    <Button size="sm" onClick={onGoToStart}>
                      Go to start page
                    </Button>
                  )}
                </div>
              </div>
            )}
          </AlertDescription>
        </Alert>
      </div>
    );
  },
);

ErrorPane.displayName = 'ErrorPane';

export {ErrorPane};
