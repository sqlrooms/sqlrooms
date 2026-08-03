import {useMemo, type FC} from 'react';
import {defaultChatRenderingComponents} from './defaultChatRendering';
import {
  ChatRenderingContext,
  useOptionalChatRendering,
} from './ChatRenderingContextBase';
import type {
  ChatRenderingComponents,
  ChatRenderingProps,
  ChatRenderingValue,
} from './ChatRenderingTypes';

function mergeChatRenderingComponents(
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

export type {
  ChatActionsProps,
  ChatActivityProps,
  ChatHoistedOutputProps,
  ChatNestedActivityMode,
  ChatPromptProps,
  ChatReasoningProps,
  ChatRenderingComponents,
  ChatRenderingProps,
  ChatRenderingValue,
  ChatTextOutputProps,
  ChatToolActivityProps,
  ChatTurnPresentation,
  ChatTurnRegions,
  ChatTurnSlotProps,
} from './ChatRenderingTypes';
