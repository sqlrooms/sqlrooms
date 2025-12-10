import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@sqlrooms/ui';
import React, {useCallback, useEffect, useRef, useState} from 'react';

interface RenameSessionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialName: string;
  onRename: (newName: string) => void;
}

/**
 * Dialog for renaming an AI session.
 */
export const RenameSessionDialog: React.FC<RenameSessionDialogProps> = ({
  isOpen,
  onClose,
  initialName,
  onRename,
}) => {
  const [name, setName] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset name and focus/select text when dialog opens
  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      const timeoutId = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [isOpen, initialName]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = name.trim();
      if (trimmed && trimmed !== initialName) {
        onRename(trimmed);
      }
      onClose();
    },
    [name, initialName, onRename, onClose],
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Rename Session</DialogTitle>
            <DialogDescription>
              Enter a new name for this session.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="session-name">Name</Label>
            <Input
              id="session-name"
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Session name"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
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
};
