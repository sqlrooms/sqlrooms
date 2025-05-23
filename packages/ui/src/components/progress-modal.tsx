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

const ProgressModal: FC<{
  isOpen: boolean;
  title?: string;
  loadingStage?: string;
  progress?: number;
  indeterminate?: boolean;
}> = (props) => {
  const {isOpen, title, loadingStage, progress, indeterminate} = props;
  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{title ?? ''}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Progress
            value={progress}
            className="w-full"
            indeterminate={indeterminate}
          />
          <DialogDescription className="text-muted-foreground flex justify-between text-sm">
            <span>{loadingStage ?? ''}</span>
            {progress ? <span>{progress}%</span> : null}
          </DialogDescription>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export {ProgressModal};
