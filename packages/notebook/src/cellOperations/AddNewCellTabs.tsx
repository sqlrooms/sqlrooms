import {Separator, Button} from '@sqlrooms/ui';
import {FC} from 'react';

import {useStoreWithNotebook} from '../useStoreWithNotebook';
import {getCellTypeLabel} from '../NotebookUtils';
import {PlusIcon} from 'lucide-react';

type Props = {
  onAdd: (type: string) => void;
};

export const AddNewCellTabs: FC<Props> = ({onAdd}) => {
  const currentTabId = useStoreWithNotebook(
    (s) => s.cells.config.currentSheetId,
  );
  const cellRegistry = useStoreWithNotebook((s) => s.cells.cellRegistry);
  const cellTypes = Object.keys(cellRegistry);

  return (
    <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 opacity-0 transition-opacity hover:opacity-100">
      <Separator className="w-full bg-gray-500" />
      <div className="flex gap-1">
        {cellTypes.map((type: string) => {
          return (
            <Button
              key={type}
              disabled={!currentTabId}
              onClick={() => onAdd(type)}
              className="h-6 gap-1 py-0 capitalize text-gray-500"
              variant="ghost"
              size="xs"
            >
              <PlusIcon size={12} strokeWidth={1.5} />
              {getCellTypeLabel(type, cellRegistry)}
            </Button>
          );
        })}
      </div>
      <Separator className="w-full bg-gray-500" />
    </div>
  );
};
