import {cn, Popover, TooltipProvider} from '@sqlrooms/ui';
import {
  createContext,
  type FC,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import type {
  ContextSelectorContextValue,
  ContextSelectorRootProps,
} from './types';
import {
  getKnownItems,
  promoteContextSelectorItem,
  reorderContextSelectorItems,
  toggleContextSelectorItem,
  uniqueIds,
} from './utils';

const ContextSelectorContext = createContext<
  ContextSelectorContextValue | undefined
>(undefined);

export function useContextSelectorContext() {
  const context = useContext(ContextSelectorContext);
  if (!context) {
    throw new Error(
      'Chat.ContextSelector compound components must be rendered inside Chat.ContextSelector.',
    );
  }
  return context;
}

export const ContextSelectorRoot: FC<ContextSelectorRootProps> = ({
  children,
  items,
  selectedIds,
  onSelectedIdsChange,
  runningContextIds,
  open,
  defaultOpen = false,
  onOpenChange,
  className,
  renderIcon,
  renderItem,
  renderBadgeLabel,
}) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = open !== undefined;
  const actualOpen = isControlled ? open : uncontrolledOpen;
  const setOpen = useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) setUncontrolledOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange],
  );
  const normalizedSelectedIds = useMemo(
    () => uniqueIds(selectedIds),
    [selectedIds],
  );
  const normalizedRunningIds = useMemo(
    () => uniqueIds(runningContextIds ?? []),
    [runningContextIds],
  );
  const selectedItems = useMemo(
    () => getKnownItems(items, normalizedSelectedIds),
    [items, normalizedSelectedIds],
  );
  const runningItems = useMemo(
    () => getKnownItems(items, normalizedRunningIds),
    [items, normalizedRunningIds],
  );
  const displayItems = runningContextIds ? runningItems : selectedItems;

  const value = useMemo<ContextSelectorContextValue>(
    () => ({
      items,
      selectedIds: normalizedSelectedIds,
      onSelectedIdsChange,
      runningContextIds,
      renderIcon,
      renderItem,
      renderBadgeLabel,
      open: actualOpen,
      setOpen,
      selectedItems,
      runningItems,
      displayItems,
      toggleItem: (itemId) => {
        onSelectedIdsChange(
          toggleContextSelectorItem(normalizedSelectedIds, itemId),
        );
      },
      removeItem: (itemId) => {
        onSelectedIdsChange(
          normalizedSelectedIds.filter((id) => id !== itemId),
        );
      },
      makeMain: (itemId) => {
        onSelectedIdsChange(
          promoteContextSelectorItem(normalizedSelectedIds, itemId),
        );
      },
      reorderItems: (activeId, overId) => {
        onSelectedIdsChange(
          reorderContextSelectorItems(normalizedSelectedIds, activeId, overId),
        );
      },
    }),
    [
      items,
      normalizedSelectedIds,
      onSelectedIdsChange,
      runningContextIds,
      renderIcon,
      renderItem,
      renderBadgeLabel,
      actualOpen,
      setOpen,
      selectedItems,
      runningItems,
      displayItems,
    ],
  );

  return (
    <ContextSelectorContext.Provider value={value}>
      <TooltipProvider delayDuration={250}>
        <Popover open={actualOpen} onOpenChange={setOpen}>
          <div className={cn('inline-flex max-w-full min-w-0', className)}>
            {children}
          </div>
        </Popover>
      </TooltipProvider>
    </ContextSelectorContext.Provider>
  );
};
