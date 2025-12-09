import {Toggle} from '@sqlrooms/ui';
import {FC} from 'react';

import {InputItem} from './Input/InputCell';
import {useStoreWithNotebook} from '../useStoreWithNotebook';

export const ShowInputBarToggle = () => {
  const toggleShowInputBar = useStoreWithNotebook(
    (s) => s.notebook.toggleShowInputBar,
  );
  const currentTabId = useStoreWithNotebook(
    (s) => s.notebook.config.currentTabId,
  );
  const showInputBar = useStoreWithNotebook(
    (s) =>
      s.notebook.config.tabs.find((t) => t.id === currentTabId)?.showInputBar,
  );

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
              <InputItem id={id} key={`cellOrder-${id}`} />
            ))
          : 'No inputs yet'}
      </div>
    </div>
  );
};
