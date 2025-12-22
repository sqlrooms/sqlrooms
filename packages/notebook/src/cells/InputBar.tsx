import {Toggle} from '@sqlrooms/ui';
import {FC} from 'react';

import {useStoreWithNotebook} from '../useStoreWithNotebook';
import {CellView} from './CellView';

export const ShowInputBarToggle = () => {
  const toggleShowInputBar = useStoreWithNotebook(
    (s) => s.notebook.toggleShowInputBar,
  );
  const currentTabId = useStoreWithNotebook(
    (s) => s.cells.config.currentSheetId,
  );
  const showInputBar = useStoreWithNotebook((s) => {
    const sheet = currentTabId
      ? s.notebook.config.sheets[currentTabId]
      : undefined;
    return sheet?.meta.showInputBar ?? true;
  });

  if (!currentTabId) return null;
  return (
    <div className="flex items-center space-x-1">
      <Toggle
        id="input-bar-mode"
        pressed={showInputBar}
        onPressedChange={() => toggleShowInputBar(currentTabId)}
        className="h-7 text-xs"
      >
        Show input bar
      </Toggle>
    </div>
  );
};

export const InputBar: FC<{inputBarOrder: string[]; showInputBar: boolean}> = ({
  inputBarOrder,
  showInputBar,
}) => {
  if (!showInputBar) return null;
  return (
    <div className="relative flex h-[85px] flex-wrap gap-2 overflow-auto border-b py-2 text-xs">
      <div className="flex flex-wrap">
        {inputBarOrder.length > 0
          ? inputBarOrder.map((id) => (
              <CellView id={id} key={`cellOrder-${id}`} />
            ))
          : 'No inputs yet'}
      </div>
    </div>
  );
};
