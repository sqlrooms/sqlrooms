import {ContextSelectorBadge} from './ContextSelectorBadge';
import {ContextSelectorRoot} from './ContextSelectorContext';
import {ContextSelectorSearchDropdown} from './ContextSelectorSearchDropdown';
import {
  CHAT_CONTEXT_SELECTOR_SLOT,
  type ContextSelectorComponent,
} from './types';

export const ContextSelector: ContextSelectorComponent = Object.assign(
  ContextSelectorRoot,
  {
    Badge: ContextSelectorBadge,
    SearchDropdown: ContextSelectorSearchDropdown,
    [CHAT_CONTEXT_SELECTOR_SLOT]: true,
  },
);
