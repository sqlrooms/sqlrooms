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
    <div className={className} {...attributes} {...listeners}>
      {children}
    </div>
  );
};
