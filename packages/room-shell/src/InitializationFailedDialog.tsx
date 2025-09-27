import {
  Button,
  cn,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  useDisclosure,
} from '@sqlrooms/ui';
import {BugIcon, ChevronDown, TriangleAlertIcon} from 'lucide-react';
import {FC} from 'react';

export const InitializationFailedDialog: FC<{
  className?: string;
  error: unknown;
}> = ({className, error}) => {
  const {isOpen, onToggle} = useDisclosure(true);
  return (
    <Dialog open={isOpen}>
      <DialogContent
        className={cn(
          'rounded-md border-none focus:outline-none sm:max-w-[425px]',
          className,
        )}
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          event.preventDefault(); // stop Radix from auto-focusing the buttons inside
        }}
      >
        <DialogHeader>
          <DialogTitle>
            <div className="flex items-center gap-2">
              <TriangleAlertIcon className="text-destructive h-4 w-4" />
              Initialization failed
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <DialogDescription
            asChild
            className="text-muted-foreground flex flex-col justify-between gap-2 text-sm"
          >
            <div className="flex flex-col gap-2">
              Sorry, the room initialization was not successful.
              <ErrorDetails triggerLabel="Show cause" error={error} />
              The application will not be functioning properly.
            </div>
          </DialogDescription>
        </div>
        <DialogFooter className="flex w-full items-center">
          <Button variant="outline" size="xs" onClick={onToggle}>
            Use anyway at my own risk
          </Button>
          <div className="flex-1" />
          <Button
            size="xs"
            onClick={() => {
              window.location.reload();
            }}
          >
            Reload page
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ErrorDetails: FC<{
  triggerLabel: string;
  error: unknown;
}> = ({triggerLabel, error}) => {
  const disclosure = useDisclosure(false);
  return (
    <Collapsible
      className="rounded-md border p-2"
      open={disclosure.isOpen}
      onOpenChange={disclosure.onToggle}
    >
      <CollapsibleTrigger asChild>
        <div className="flex cursor-pointer items-center justify-between">
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <BugIcon className="h-4 w-4" />
            {triggerLabel}
          </div>
          <Button variant="ghost" size="xs" className="h-6 px-2">
            <ChevronDown
              className={`h-4 w-4 transition-transform ${disclosure.isOpen ? 'rotate-180' : ''}`}
            />
          </Button>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-muted bg-muted/30 mt-2 max-h-[300px] overflow-y-auto rounded-md border p-2">
          <pre className="text-destructive whitespace-pre-wrap break-words font-mono text-xs">
            {String(error)}
          </pre>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
