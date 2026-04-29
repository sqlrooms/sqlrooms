import {FC, PropsWithChildren} from 'react';
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
      className={className}
      data-layout-drag-handle="true"
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
};
