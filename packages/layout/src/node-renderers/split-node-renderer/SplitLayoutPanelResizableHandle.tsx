import {FC, ComponentProps} from 'react';
import {cn, ResizableHandle} from '@sqlrooms/ui';

export const SplitLayoutPanelResizableHandle: FC<
  ComponentProps<typeof ResizableHandle>
> = ({className, ...props}) => (
  <ResizableHandle
    className={cn(`bg-border hover:bg-primary/60 transition-colors`, className)}
    {...props}
  />
);
