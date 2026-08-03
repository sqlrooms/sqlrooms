import {createContext, useContext} from 'react';
import type {
  ChatNestedActivityMode,
  ChatRenderingValue,
} from './ChatRenderingTypes';

export const ChatRenderingContext = createContext<ChatRenderingValue | null>(
  null,
);

export function useOptionalChatRendering(): ChatRenderingValue | null {
  return useContext(ChatRenderingContext);
}

export function useResolvedChatNestedActivityMode(): ChatNestedActivityMode {
  return useContext(ChatRenderingContext)?.nestedActivityMode ?? 'own-boxes';
}
