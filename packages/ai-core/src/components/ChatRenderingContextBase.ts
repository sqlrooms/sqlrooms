import {createContext, useContext} from 'react';
import type {
  ChatNestedActivityMode,
  ChatRenderingComponents,
  ChatRenderingValue,
} from './ChatRenderingTypes';

/** Default nested-agent activity composition used without an override. */
export const DEFAULT_CHAT_NESTED_ACTIVITY_MODE: ChatNestedActivityMode =
  'own-boxes';

/** Context containing the nearest resolved chat rendering recipe. */
export const ChatRenderingContext = createContext<ChatRenderingValue | null>(
  null,
);

const EMPTY_CHAT_RENDERING_OVERRIDES = new Set<keyof ChatRenderingComponents>();

/** Context tracking slots explicitly overridden by rendering providers. */
export const ChatRenderingOverridesContext = createContext<
  ReadonlySet<keyof ChatRenderingComponents>
>(EMPTY_CHAT_RENDERING_OVERRIDES);

/** Return the nearest rendering recipe, or null when no provider is present. */
export function useOptionalChatRendering(): ChatRenderingValue | null {
  return useContext(ChatRenderingContext);
}

/** Return the rendering slots explicitly overridden in the current subtree. */
export function useChatRenderingOverrides(): ReadonlySet<
  keyof ChatRenderingComponents
> {
  return useContext(ChatRenderingOverridesContext);
}

/** Return the resolved nested activity mode, including the default fallback. */
export function useResolvedChatNestedActivityMode(): ChatNestedActivityMode {
  return (
    useContext(ChatRenderingContext)?.nestedActivityMode ??
    DEFAULT_CHAT_NESTED_ACTIVITY_MODE
  );
}
