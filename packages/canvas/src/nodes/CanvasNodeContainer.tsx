import {Button, EditableText, cn} from '@sqlrooms/ui';
import {Handle, NodeResizer, Position} from '@xyflow/react';
import {FC, PropsWithChildren, ReactNode} from 'react';
import {AddNodePopover} from './AddNodePopover';
import {PlusIcon} from 'lucide-react';

/**
 * Container applied to every canvas node. Provides resizing, connection handles,
 * and a standard "add child" affordance that creates downstream nodes.
 * Also renders an optional shared header with editable title and customizable right-side content.
 */
export const CanvasNodeContainer: FC<
  PropsWithChildren<{
    id: string;
    className?: string;
    /** Title shown in the header. If provided, a header will be rendered. */
    title?: string;
    /** Callback when title changes. Ignored if not provided. */
    onTitleChange?: (value: string) => void | Promise<void>;
    /** Right-side header content (e.g. buttons, badges). */
    headerRight?: ReactNode;
  }>
> = ({id, className, title, onTitleChange, headerRight, children}) => {
  return (
    <div
      className={cn(
        `bg-background relative flex h-full w-full rounded-md border shadow-sm`,
        className,
      )}
    >
      <NodeResizer minWidth={200} minHeight={200} />
      <div className="flex h-full w-full flex-col">
        {(title !== undefined || headerRight) && (
          <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
            <EditableText
              className="text-sm font-medium"
              value={title ?? ''}
              onChange={(v) => onTitleChange?.(v)}
            />
            <div className="flex items-center gap-2">{headerRight}</div>
          </div>
        )}
        <div className="w-full flex-1">{children}</div>
      </div>
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
