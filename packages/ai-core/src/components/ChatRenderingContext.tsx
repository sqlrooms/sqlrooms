import {useMemo, type FC} from 'react';
import {defaultChatRenderingComponents} from './defaultChatRendering';
import {
  ChatRenderingContext,
  useOptionalChatRendering,
  useResolvedChatNestedActivityMode,
} from './ChatRenderingContextBase';
import type {
  ChatNestedActivityMode,
  ChatRenderingComponents,
  ChatRenderingProps,
  ChatRenderingValue,
} from './ChatRenderingTypes';

/** Merge a partial chat recipe over an already resolved recipe. */
export function mergeChatRenderingComponents(
  base: ChatRenderingComponents,
  overrides?: Partial<ChatRenderingComponents>,
): ChatRenderingComponents {
  if (!overrides) return base;
  return {
    Turn: overrides.Turn ?? base.Turn,
    Prompt: overrides.Prompt ?? base.Prompt,
    Activity: overrides.Activity ?? base.Activity,
    Reasoning: overrides.Reasoning ?? base.Reasoning,
    TextOutput: overrides.TextOutput ?? base.TextOutput,
    ToolActivity: overrides.ToolActivity ?? base.ToolActivity,
    HoistedOutput: overrides.HoistedOutput ?? base.HoistedOutput,
    Actions: overrides.Actions ?? base.Actions,
  };
}

/**
 * Subtree-scoped chat presentation recipe. Partial overrides merge with the
 * parent recipe or SQLRooms defaults.
 *
 * @example
 * ```tsx
 * <Chat.Rendering components={{Activity: AppActivity}}>
 *   <Chat.Messages />
 * </Chat.Rendering>
 * ```
 */
export const ChatRendering: FC<ChatRenderingProps> = ({
  children,
  components,
  nestedActivityMode,
}) => {
  const parent = useOptionalChatRendering();
  const value = useMemo<ChatRenderingValue>(() => {
    const baseComponents = parent?.components ?? defaultChatRenderingComponents;
    return {
      components: mergeChatRenderingComponents(baseComponents, components),
      nestedActivityMode:
        nestedActivityMode ?? parent?.nestedActivityMode ?? 'own-boxes',
    };
  }, [parent, components, nestedActivityMode]);

  return (
    <ChatRenderingContext.Provider value={value}>
      {children}
    </ChatRenderingContext.Provider>
  );
};

export function useChatRendering(): ChatRenderingValue {
  return (
    useOptionalChatRendering() ?? {
      components: defaultChatRenderingComponents,
      nestedActivityMode: 'own-boxes',
    }
  );
}

export function useChatRenderingComponents(): ChatRenderingComponents {
  return (
    useOptionalChatRendering()?.components ?? defaultChatRenderingComponents
  );
}

/** Return the nested activity mode for the nearest chat rendering recipe. */
export function useChatNestedActivityMode(): ChatNestedActivityMode {
  return useResolvedChatNestedActivityMode();
}

export type {
  ChatActionsProps,
  ChatActionsRegion,
  ChatActivityItem,
  ChatActivityProps,
  ChatActivityRegion,
  ChatHoistedOutputProps,
  ChatNestedActivityMode,
  ChatOutputItem,
  ChatOutputRegion,
  ChatPromptProps,
  ChatPromptRegion,
  ChatReasoningProps,
  ChatRenderingComponents,
  ChatRenderingProps,
  ChatRenderingValue,
  ChatTextItem,
  ChatTextOutputProps,
  ChatTextRegion,
  ChatTimelineRegion,
  ChatToolActivityProps,
  ChatToolState,
  ChatTurnPresentation,
  ChatTurnSlotProps,
} from './ChatRenderingTypes';
