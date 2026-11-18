import {cn, Slot} from '@sqlrooms/ui';
import {PropsWithChildren} from 'react';

/**
 * A schema tree row with an adaptive minimum height and clipped horizontal overflow.
 * Content stays in normal flow so larger text can increase the row height.
 */
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
        'hover:bg-foreground/10 flex min-h-5.5 w-full min-w-0 grow cursor-pointer items-center rounded-sm p-px select-none',
        className,
      )}
    >
      <div className="group/treenode relative flex w-full min-w-0 items-center overflow-hidden">
        <div className="flex w-full min-w-0 items-center whitespace-nowrap">
          {children}
        </div>
      </div>
    </Comp>
  );
}
