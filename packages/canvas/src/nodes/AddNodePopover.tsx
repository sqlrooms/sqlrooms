import {
  Button,
  cn,
  Popover,
  PopoverContent,
  PopoverTrigger,
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
  const onAddSql = () => {
    if (sheetId) {
      addNode({sheetId, parentId, nodeType: 'sql'});
      setOpen(false);
    }
  };
  const onAddVega = () => {
    if (sheetId) {
      addNode({sheetId, parentId, nodeType: 'vega'});
      setOpen(false);
    }
  };
  return (
    <div className={cn(className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{children}</PopoverTrigger>
        <PopoverContent
          side="right"
          align="center"
          className="max-w-[100px] border-none bg-transparent p-0 shadow-none"
        >
          <div className="flex flex-col gap-2">
            <Button size="xs" onClick={onAddSql}>
              Query
            </Button>
            <Button size="xs" onClick={onAddVega}>
              Visualize
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
