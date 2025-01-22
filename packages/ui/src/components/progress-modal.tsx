import {FC} from 'react';
import {Dialog, DialogContent, DialogHeader, DialogTitle} from './dialog';
import {Progress} from './progress';

type Props = {
  isOpen: boolean;
  title?: string;
  loadingStage?: string;
  progress?: number;
};

const ProgressModal: FC<Props> = (props) => {
  const {isOpen, title, loadingStage, progress} = props;

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{title ?? ''}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Progress value={progress} className="w-full" />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{loadingStage ?? ''}</span>
            {progress ? <span>{progress}%</span> : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export {ProgressModal};
