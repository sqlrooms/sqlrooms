'use client';

import {FC} from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './dialog';
import {Progress} from './progress';
import {cn} from '../lib/utils';

const ProgressModal: FC<{
  className?: string;
  isOpen: boolean;
  title?: string;
  loadingStage?: string;
  progress?: number;
  indeterminate?: boolean;
  error?: string;
}> = (props) => {
  const {
    className,
    isOpen,
    title,
    loadingStage,
    progress,
    indeterminate,
    error,
  } = props;
  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent
        className={cn(
          'rounded-md border-none focus:outline-hidden sm:max-w-[425px]',
          className,
        )}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>{title ?? ''}</DialogTitle>
        </DialogHeader>
        {error ? (
          <div className="flex flex-col gap-3">
            <DialogDescription className="text-destructive text-sm font-medium">
              {loadingStage ?? 'Initialization failed'}
            </DialogDescription>
            <pre className="bg-muted text-muted-foreground max-h-40 overflow-auto rounded-md p-3 text-xs whitespace-pre-wrap">
              {error}
            </pre>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Progress
              value={progress}
              className="h-2 w-full"
              indeterminate={indeterminate}
            />
            <DialogDescription className="text-muted-foreground flex justify-between text-sm">
              <span className="text-sm">{loadingStage ?? ''}</span>
              {progress ? <span>{progress}%</span> : null}
            </DialogDescription>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export {ProgressModal};
