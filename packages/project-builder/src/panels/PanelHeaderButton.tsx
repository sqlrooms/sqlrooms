import {Button} from '@sqlrooms/ui';
import React, {FC} from 'react';

const PanelHeaderButton: FC<{
  label: string;
  icon: React.ReactElement;
  isPinned?: boolean;
  onClick: () => void;
}> = (props) => {
  const {isPinned, icon, label, onClick} = props;
  return (
    <Button
      size="icon"
      onClick={onClick}
      variant="ghost"
      className={`h-6 w-6 ${
        isPinned ? 'text-white' : 'text-muted-foreground'
      } hover:text-white hover:bg-white/10`}
      aria-label={label}
    >
      {icon}
    </Button>
  );
};

export {PanelHeaderButton};
