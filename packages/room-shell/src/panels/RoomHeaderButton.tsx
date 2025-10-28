import {Button} from '@sqlrooms/ui';
import React, {FC} from 'react';

const PanelHeaderButton: FC<{
  label: string;
  icon: React.ReactElement;
  onClick: () => void;
}> = (props) => {
  const {icon, label, onClick} = props;
  return (
    <Button
      size="icon"
      onClick={onClick}
      variant="ghost"
      className={`h-4 w-4 text-muted-foreground`}
      aria-label={label}
    >
      {icon}
    </Button>
  );
};

export {PanelHeaderButton};
