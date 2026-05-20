import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '@sqlrooms/ui';
import {FC, FormEvent, useCallback, useEffect, useRef} from 'react';

export type LinkInputDialogProps = {
  open: boolean;
  value: string;
  onValueChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onConfirm: (href: string) => void;
};

export const LinkInputDialog: FC<LinkInputDialogProps> = ({
  open,
  value,
  onValueChange,
  onOpenChange,
  onConfirm,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const timeoutRef = window.setTimeout(() => inputRef.current?.focus(), 0);

    return () => window.clearTimeout(timeoutRef);
  }, [open]);

  const onSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      onConfirm(value);
    },
    [value, onConfirm],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Link URL</DialogTitle>
          </DialogHeader>
          <Input
            ref={inputRef}
            value={value}
            className="mt-4"
            placeholder="https://example.com"
            onChange={(event) => onValueChange(event.target.value)}
          />
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Apply</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
