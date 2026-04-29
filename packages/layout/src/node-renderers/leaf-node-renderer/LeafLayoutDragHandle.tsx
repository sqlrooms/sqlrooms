import {FC, PropsWithChildren} from 'react';
import {cn} from '@sqlrooms/ui';
import {useLeafLayoutPanelDraggable} from './LeafLayoutPanelDraggableContext';

type LeafLayoutDragHandleProps = PropsWithChildren<{
  className?: string;
}>;

export const LeafLayoutDragHandle: FC<LeafLayoutDragHandleProps> = ({
  children,
  className,
}) => {
  const {attributes, listeners} = useLeafLayoutPanelDraggable();

  return (
    <div
      className={cn('select-none', className)}
      data-layout-drag-handle="true"
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
};
