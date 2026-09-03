import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '@sqlrooms/ui';
import {type FormEvent, useEffect, useState} from 'react';

export type NavigationItem = {id: string; name: string};

export function RenameNavigationItemDialog({
  item,
  itemType,
  onOpenChange,
  onRename,
}: {
  item: NavigationItem | null;
  itemType: 'chat' | 'document';
  onOpenChange: (open: boolean) => void;
  onRename: (itemId: string, name: string) => void;
}) {
  const [name, setName] = useState('');

  useEffect(() => {
    setName(item?.name ?? '');
  }, [item]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextName = name.trim();
    if (item && nextName) onRename(item.id, nextName);
  };

  return (
    <Dialog open={Boolean(item)} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Rename {itemType}</DialogTitle>
            <DialogDescription>
              Choose a name for this {itemType}.
            </DialogDescription>
          </DialogHeader>
          <Input
            className="my-4"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Rename
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteNavigationItemDialog({
  item,
  itemType,
  onOpenChange,
  onConfirm,
}: {
  item: NavigationItem | null;
  itemType: 'chat' | 'document';
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={Boolean(item)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {itemType}?</DialogTitle>
          <DialogDescription>
            “{item?.name}” will be permanently deleted.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
