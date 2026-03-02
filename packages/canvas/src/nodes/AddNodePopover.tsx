import {
  Button,
  cn,
  Popover,
  PopoverContent,
  PopoverTrigger,
  useToast,
} from '@sqlrooms/ui';
import {FC, PropsWithChildren, useState} from 'react';
import {useStoreWithCanvas} from '../CanvasSlice';

export const AddNodePopover: FC<
  PropsWithChildren<{
    className?: string;
    parentId?: string;
  }>
> = ({className, parentId, children}) => {
  const [open, setOpen] = useState(false);
  const addNode = useStoreWithCanvas((s) => s.canvas.addNode);
  const sheetId = useStoreWithCanvas((s) => s.cells.config.currentSheetId);
  const registry = useStoreWithCanvas((s) => s.cells.cellRegistry);
  const {toast} = useToast();
  const onAdd = (type: string) => {
    if (sheetId) {
      addNode({sheetId, parentId, nodeType: type});
      setOpen(false);
    } else {
      toast({
        variant: 'destructive',
        description: 'No sheet selected',
      });
    }
  };

  return (
    <div className={cn(className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{children}</PopoverTrigger>
        <PopoverContent
          side="right"
          align="center"
          className="flex w-auto flex-col gap-2 p-2"
        >
          {Object.entries(registry).map(([type, reg]) => (
            <Button key={type} size="xs" onClick={() => onAdd(type)}>
              {reg.title}
            </Button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
};
