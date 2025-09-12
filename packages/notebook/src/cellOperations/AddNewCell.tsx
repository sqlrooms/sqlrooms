import {Popover, PopoverTrigger} from '@sqlrooms/ui';
import {FC, useEffect, useState} from 'react';

import {useStoreWithNotebook} from '../NotebookSlice';
import {NotebookCellTypes} from '../cellSchemas';
import {AddNewCellDropdownContent} from './AddNewCellDropdownContent';

type Props = {
  onAdd: (type: NotebookCellTypes) => void;
  enableShortcut?: boolean;
  triggerComponent?: React.ReactNode;
};

export const AddNewCell: FC<Props> = ({
  onAdd,
  enableShortcut = false,
  triggerComponent,
}) => {
  const currentTabId = useStoreWithNotebook(
    (s) => s.config.notebook.currentTabId,
  );
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!currentTabId || !enableShortcut) {
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'j' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger>{triggerComponent}</PopoverTrigger>

      <AddNewCellDropdownContent
        onAddCell={onAdd}
        currentTabId={currentTabId}
        setOpen={setOpen}
      />
    </Popover>
  );
};
