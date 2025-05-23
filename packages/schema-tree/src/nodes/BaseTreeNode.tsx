import {Slot} from '@radix-ui/react-slot';
import {cn} from '@sqlrooms/ui';
import {PropsWithChildren} from 'react';

export function BaseTreeNode<T>(
  props: PropsWithChildren<{
    className?: string;
    nodeData: T;
    asChild?: boolean;
  }>,
) {
  const {className, asChild, children} = props;
  const Comp = asChild ? Slot : 'div';
  return (
    <Comp
      className={cn(
        'hover:bg-foreground/10 w-full flex-grow cursor-pointer select-none rounded-sm p-[1px]',
        className,
      )}
    >
      <div
        className={cn(
          'group relative flex w-full items-center overflow-hidden',
          className,
        )}
      >
        {children}
      </div>
    </Comp>
  );
}
