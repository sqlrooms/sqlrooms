import React, {FC} from 'react';
import {Button} from '@sqlrooms/ui';
import {ArrowDownIcon, ArrowUpIcon} from 'lucide-react';

import {useStoreWithNotebook} from '../useStoreWithNotebook';

type Props = {
  id: string;
};

export const MoveCellButtons: FC<Props> = ({id}) => {
  const moveCell = useStoreWithNotebook((s) => s.notebook.moveCell);
  const currentTabId = useStoreWithNotebook(
    (s) => s.notebook.config.currentSheetId,
  );
  if (!currentTabId) return null;

  return (
    <div className="flex gap-1">
      <Button
        variant="ghost"
        className="h-6 w-6"
        size="xs"
        onClick={() => moveCell(currentTabId, id, 'up')}
      >
        <ArrowUpIcon className="text-gray-500" />
      </Button>
      <Button
        variant="ghost"
        className="h-6 w-6"
        size="xs"
        onClick={() => moveCell(currentTabId, id, 'down')}
      >
        <ArrowDownIcon className="text-gray-500" />
      </Button>
    </div>
  );
};
