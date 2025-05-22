// Copyright 2022 Foursquare Labs, Inc. All Rights Reserved.

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  cn,
} from '@sqlrooms/ui';
import {
  ComponentPropsWithoutRef,
  ElementRef,
  FC,
  forwardRef,
  PropsWithChildren,
} from 'react';
import {EllipsisVerticalIcon} from 'lucide-react';

export type TreeNodeActionsMenuProps = PropsWithChildren<{
  className?: string;
}>;

/**
 * Component that renders a tree node "more actions" menu.
 * The menu items are passed as children.
 *
 * The menu is hidden by default and is shown when the user hovers over the node.
 * For this to work the parent element must have the `group` class.
 * It should also have classes `relative overflow-hidden`.
 *
 * @param children - The menu items.
 */
export const TreeNodeActionsMenu: FC<TreeNodeActionsMenuProps> = (props) => {
  const {children} = props;
  return (
    <div className="absolute right-0 top-[1px] opacity-0 outline-none group-hover:opacity-100">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className="hover:bg-foreground/10 flex h-5 w-7 items-center justify-center p-0 outline-none transition-colors">
            <EllipsisVerticalIcon size="16px" />
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="bottom">
          {children}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export const TreeNodeActionsMenuItem = forwardRef<
  ElementRef<typeof DropdownMenuItem>,
  ComponentPropsWithoutRef<typeof DropdownMenuItem>
>(({className, ...props}, ref) => (
  <DropdownMenuItem
    ref={ref}
    className={cn('gap-2 text-xs', className)}
    {...props}
  />
));
TreeNodeActionsMenuItem.displayName = 'TreeNodeActionsMenuItem';
