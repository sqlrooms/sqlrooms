import {Button} from '@sqlrooms/ui';
import {ChevronsRightIcon, ChevronsUpIcon} from 'lucide-react';
import {FC} from 'react';
import {ParentDirection} from '../types';

export type ExpandButtonProps = {
  direction?: ParentDirection;
  onClick: () => void;
};

export const ExpandButton: FC<ExpandButtonProps> = ({direction, onClick}) => {
  const Icon =
    direction === 'column'
      ? ChevronsUpIcon
      : direction === 'row'
        ? ChevronsRightIcon
        : ChevronsRightIcon;

  return (
    <Button
      variant="ghost"
      size="icon"
      className="hover:bg-primary/10 h-7 w-7 shrink-0"
      onClick={onClick}
      aria-label="Expand"
    >
      <Icon className="h-3.5 w-3.5" />
    </Button>
  );
};
