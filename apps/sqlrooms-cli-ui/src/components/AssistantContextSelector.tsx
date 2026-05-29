import {CHAT_CONTEXT_SELECTOR_SLOT, Chat} from '@sqlrooms/ai';
import {FC, useCallback} from 'react';
import {useRoomStore} from '../store';
import {useAutoContextReplacement} from './useAutoContextReplacement';
import {
  useContextSelectorItems,
  useRunningContextIds,
  useValidatedSelectedIds,
} from './useAssistantContextItems';

export const AssistantContextSelector: FC = () => {
  const setAiContextItemIds = useRoomStore((s) => s.setAiContextItemIds);

  // Get all the data we need via custom hooks
  const items = useContextSelectorItems();
  const selectedIds = useValidatedSelectedIds();
  const runningContextIds = useRunningContextIds();

  // Auto-replace context with current artifact in auto mode
  useAutoContextReplacement();

  const handleSelectedIdsChange = useCallback(
    (nextIds: string[]) => {
      setAiContextItemIds(nextIds, 'manual');
    },
    [setAiContextItemIds],
  );

  if (items.length === 0 && selectedIds.length === 0) return null;

  return (
    <Chat.ContextSelector
      items={items}
      selectedIds={selectedIds}
      onSelectedIdsChange={handleSelectedIdsChange}
      runningContextIds={runningContextIds}
    >
      <Chat.ContextSelector.Badge tooltip="Add context" />
      <Chat.ContextSelector.SearchDropdown
        searchPlaceholder="Search context..."
        emptyLabel="No context items found."
      />
    </Chat.ContextSelector>
  );
};

Object.assign(AssistantContextSelector, {
  [CHAT_CONTEXT_SELECTOR_SLOT]: true,
});
