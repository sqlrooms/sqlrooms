import {QueryControls} from '@sqlrooms/ai';
import {
  Button,
  EditableText,
  Popover,
  PopoverContent,
  PopoverTrigger,
  cn,
} from '@sqlrooms/ui';
import {Handle, NodeResizer, Position} from '@xyflow/react';
import {PlusIcon, SparklesIcon} from 'lucide-react';
import {FC, PropsWithChildren, ReactNode, useCallback} from 'react';
import {useStoreWithCanvas} from '../CanvasSlice';
import {AddNodePopover} from './AddNodePopover';

const PROMPT_PLACEHOLDER = {
  sql: 'What would you like to learn about the data?',
  vega: 'How would you like to visualize the data?',
  default: 'What would you like to do?',
};

/**
 * Container applied to every canvas node. Provides resizing, connection handles,
 * and a standard "add child" affordance that creates downstream nodes.
 * Also renders an optional shared header with editable title and customizable right-side content.
 */
export const CanvasNodeContainer: FC<
  PropsWithChildren<{
    id: string;
    className?: string;
    /** Right-side header content (e.g. buttons, badges). */
    headerRight?: ReactNode;
  }>
> = ({id, className, headerRight, children}) => {
  const renameNode = useStoreWithCanvas((s) => s.canvas.renameNode);
  const node = useStoreWithCanvas((s) =>
    s.config.canvas.nodes.find((n) => n.id === id),
  );
  const title = node?.data.title;
  const onTitleChange = useCallback(
    async (v: string) => {
      await renameNode(id, v);
    },
    [id, renameNode],
  );
  const setAssistantOpen = useStoreWithCanvas((s) => s.canvas.setAssistantOpen);
  return (
    <div
      className={cn(
        `bg-background relative flex h-full w-full rounded-md border shadow-sm`,
        className,
      )}
    >
      <NodeResizer minWidth={200} minHeight={200} />
      <div className="flex h-full min-h-0 w-full flex-col items-center">
        {(title !== undefined || headerRight) && (
          <div className="flex w-full items-center justify-between gap-2 border-b px-3 py-2">
            <EditableText
              className="text-sm font-medium"
              value={title ?? ''}
              onChange={(v) => onTitleChange?.(v)}
            />
            <div className="flex items-center gap-2">{headerRight}</div>
          </div>
        )}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="default"
              className="h-8 w-8 -translate-y-1/2 rounded-full"
            >
              <SparklesIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="max-h-[50vh] w-[400px] overflow-auto">
            <QueryControls
              placeholder={`✨ ${PROMPT_PLACEHOLDER[node?.type ?? 'default']}`}
              onRun={() => {
                setAssistantOpen(true);
              }}
            />
          </PopoverContent>
        </Popover>
        <div className="w-full flex-1 overflow-auto">{children}</div>
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
