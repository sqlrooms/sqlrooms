import {Button} from '@sqlrooms/ui';
import React from 'react';

export const TriggerButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button>
>(({children = 'Add new', ...props}, ref) => {
  return (
    <Button ref={ref} size="xs" className="h-7" {...props}>
      {children}
    </Button>
  );
});
TriggerButton.displayName = 'TriggerButton';
