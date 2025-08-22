import {useState} from 'react';
import {
  Button,
  cn,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@sqlrooms/ui';
import {PlusIcon} from 'lucide-react';

export function AddChildButton({
  className,
  onAddSql,
  onAddVega,
}: {
  className?: string;
  onAddSql: () => void;
  onAddVega: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn(className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="default"
            className="h-8 w-8 -translate-y-1/2 rounded-full"
            title="Add child node"
          >
            <PlusIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          side="right"
          align="center"
          className="max-w-[150px] border-none bg-transparent p-0 shadow-none"
        >
          <div className="flex flex-col gap-2">
            <Button
              size="xs"
              onClick={() => {
                onAddSql();
                setOpen(false);
              }}
            >
              Query results
            </Button>
            <Button
              size="xs"
              onClick={() => {
                onAddVega();
                setOpen(false);
              }}
            >
              Visualize results
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
