import {Button} from '@sqlrooms/ui';
import {XIcon} from 'lucide-react';
import {FC} from 'react';

export type CollapseButtonProps = {
  onClick: () => void;
};

export const CollapseButton: FC<CollapseButtonProps> = ({onClick}) => {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="hover:bg-primary/10 h-7 w-7 shrink-0"
      onClick={onClick}
      aria-label="Collapse"
    >
      <XIcon className="h-3.5 w-3.5" />
    </Button>
  );
};
