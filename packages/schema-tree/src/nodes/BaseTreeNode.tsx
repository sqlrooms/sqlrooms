import {cn, Slot} from '@sqlrooms/ui';
import {PropsWithChildren} from 'react';

export function BaseTreeNode<T>(
  props: PropsWithChildren<{
    className?: string;
    nodeObject: T;
    asChild?: boolean;
  }>,
) {
  const {className, asChild, children} = props;
  const Comp = asChild ? Slot : 'div';
  return (
    <Comp
      className={cn(
        'hover:bg-foreground/10 h-[22px] w-full flex-grow cursor-pointer select-none rounded-sm p-[1px]',
        className,
      )}
    >
      <div
        className={cn(
          'group relative flex w-full items-center overflow-hidden',
          className,
        )}
      >
        <div className="absolute h-full w-full items-center">{children}</div>
      </div>
    </Comp>
  );
}
