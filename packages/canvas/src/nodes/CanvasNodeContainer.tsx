import {Handle, Position, NodeResizer} from '@xyflow/react';
import {FC, PropsWithChildren} from 'react';
import {useStoreWithCanvas} from '../CanvasSlice';
import {AddChildButton} from './AddChildButton';
import {cn} from '@sqlrooms/ui';

export const CanvasNodeContainer: FC<
  PropsWithChildren<{id: string; className?: string}>
> = ({id, className, children}) => {
  const addChild = useStoreWithCanvas((s) => s.canvas.addNode);
  return (
    <div
      className={cn(
        `relative flex h-full w-full rounded-md border bg-white shadow-sm`,
        className,
      )}
    >
      <NodeResizer minWidth={200} minHeight={200} />
      <div className="h-full w-full">{children}</div>
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Left} />
      <AddChildButton onClick={() => addChild({parentId: id})} />
    </div>
  );
};
