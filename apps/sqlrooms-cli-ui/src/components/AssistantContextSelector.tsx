import {CHAT_CONTEXT_SELECTOR_SLOT, Chat} from '@sqlrooms/ai';
import {FC, useCallback} from 'react';
import {useRoomStore} from '../store';
import {
  useContextSelectorItems,
  useRunningContextIds,
  useValidatedSelectedIds,
} from './useAssistantContextItems';

export const AssistantContextSelector: FC = () => {
  const currentSession = useRoomStore((s) => s.ai.getCurrentSession());
  const setSessionDraftContextItemIds = useRoomStore(
    (s) => s.ai.setSessionDraftContextItemIds,
  );

  // Get all the data we need via custom hooks
  const items = useContextSelectorItems();
  const selectedIds = useValidatedSelectedIds();
  const runningContextIds = useRunningContextIds();

  const handleSelectedIdsChange = useCallback(
    (nextIds: string[]) => {
      if (currentSession) {
        setSessionDraftContextItemIds(currentSession.id, nextIds);
      }
    },
    [currentSession, setSessionDraftContextItemIds],
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
