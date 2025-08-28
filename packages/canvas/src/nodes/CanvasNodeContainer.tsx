import {Button, cn} from '@sqlrooms/ui';
import {Handle, NodeResizer, Position} from '@xyflow/react';
import {FC, PropsWithChildren} from 'react';
import {useStoreWithCanvas} from '../CanvasSlice';
import {AddNodePopover} from './AddNodePopover';
import {PlusIcon} from 'lucide-react';

/**
 * Container applied to every canvas node. Provides resizing, connection handles,
 * and a standard "add child" affordance that creates downstream nodes.
 */
export const CanvasNodeContainer: FC<
  PropsWithChildren<{id: string; className?: string}>
> = ({id, className, children}) => {
  return (
    <div
      className={cn(
        `bg-background relative flex h-full w-full rounded-md border shadow-sm`,
        className,
      )}
    >
      <NodeResizer minWidth={200} minHeight={200} />
      <div className="h-full w-full">{children}</div>
      <AddNodePopover className="absolute -right-10 top-1/2" parentId={id}>
        <Button
          variant="default"
          className="h-8 w-8 -translate-y-1/2 rounded-full"
          title="Add child node"
        >
          <PlusIcon className="h-4 w-4" />
        </Button>
      </AddNodePopover>
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Left} />
    </div>
  );
};
