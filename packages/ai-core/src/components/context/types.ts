import type {FC, PropsWithChildren, ReactNode} from 'react';

export const CHAT_CONTEXT_SELECTOR_SLOT = Symbol.for(
  'sqlrooms.ai.contextSelectorSlot',
);

export type ContextSelectorItem = {
  id: string;
  kind: string;
  title: string;
  type?: string;
  subtitle?: string;
  disabled?: boolean;
  missing?: boolean;
  keywords?: string[];
};

export type RenderItemArgs = {
  item: ContextSelectorItem;
  selected: boolean;
  main: boolean;
  running: boolean;
};

export type ContextSelectorRootProps = PropsWithChildren<{
  items: ContextSelectorItem[];
  selectedIds: string[];
  onSelectedIdsChange: (nextIds: string[]) => void;
  runningContextIds?: string[];
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  renderIcon?: (item: ContextSelectorItem) => ReactNode;
  renderItem?: (args: RenderItemArgs) => ReactNode;
  renderBadgeLabel?: (args: {
    mainItem: ContextSelectorItem | undefined;
    selectedItems: ContextSelectorItem[];
    runningItems: ContextSelectorItem[];
  }) => ReactNode;
}>;

export type ContextSelectorBadgeProps = {
  className?: string;
  tooltip?: ReactNode;
  emptyLabel?: ReactNode;
  addLabel?: string;
};

export type ContextSelectorSearchDropdownProps = {
  className?: string;
  align?: 'start' | 'center' | 'end';
  searchPlaceholder?: string;
  emptyLabel?: ReactNode;
};

export type ContextSelectorContextValue = Omit<
  ContextSelectorRootProps,
  'children' | 'open' | 'defaultOpen' | 'onOpenChange' | 'className'
> & {
  open: boolean;
  setOpen: (open: boolean) => void;
  selectedItems: ContextSelectorItem[];
  runningItems: ContextSelectorItem[];
  displayItems: ContextSelectorItem[];
  toggleItem: (itemId: string) => void;
  removeItem: (itemId: string) => void;
  makeMain: (itemId: string) => void;
  reorderItems: (activeId: string, overId: string) => void;
};

export type ContextSelectorComponent = FC<ContextSelectorRootProps> & {
  Badge: FC<ContextSelectorBadgeProps>;
  SearchDropdown: FC<ContextSelectorSearchDropdownProps>;
};
