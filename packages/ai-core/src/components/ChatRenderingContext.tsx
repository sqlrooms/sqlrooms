import {useMemo, type FC} from 'react';
import {defaultChatRenderingComponents} from './defaultChatRendering';
import {
  ChatRenderingContext,
  ChatRenderingOverridesContext,
  DEFAULT_CHAT_NESTED_ACTIVITY_MODE,
  useChatRenderingOverrides,
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
    ActiveStatus: overrides.ActiveStatus ?? base.ActiveStatus,
    Turn: overrides.Turn ?? base.Turn,
    Prompt: overrides.Prompt ?? base.Prompt,
    Activity: overrides.Activity ?? base.Activity,
    Reasoning: overrides.Reasoning ?? base.Reasoning,
    TextOutput: overrides.TextOutput ?? base.TextOutput,
    ToolActivity: overrides.ToolActivity ?? base.ToolActivity,
    HoistedOutput: overrides.HoistedOutput ?? base.HoistedOutput,
    Error: overrides.Error ?? base.Error,
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
  const parentOverrides = useChatRenderingOverrides();
  const value = useMemo<ChatRenderingValue>(() => {
    const baseComponents = parent?.components ?? defaultChatRenderingComponents;
    return {
      components: mergeChatRenderingComponents(baseComponents, components),
      nestedActivityMode:
        nestedActivityMode ??
        parent?.nestedActivityMode ??
        DEFAULT_CHAT_NESTED_ACTIVITY_MODE,
    };
  }, [parent, components, nestedActivityMode]);
  const overriddenComponents = useMemo(() => {
    if (!components) return parentOverrides;
    const result = new Set(parentOverrides);
    for (const [name, component] of Object.entries(components)) {
      if (component) {
        result.add(name as keyof ChatRenderingComponents);
      }
    }
    return result;
  }, [parentOverrides, components]);

  return (
    <ChatRenderingOverridesContext.Provider value={overriddenComponents}>
      <ChatRenderingContext.Provider value={value}>
        {children}
      </ChatRenderingContext.Provider>
    </ChatRenderingOverridesContext.Provider>
  );
};

const defaultChatRenderingValue: ChatRenderingValue = {
  components: defaultChatRenderingComponents,
  nestedActivityMode: DEFAULT_CHAT_NESTED_ACTIVITY_MODE,
};

/** Return the nearest resolved chat recipe or the stable built-in recipe. */
export function useChatRendering(): ChatRenderingValue {
  return useOptionalChatRendering() ?? defaultChatRenderingValue;
}

/** Return the component slots from the nearest resolved chat recipe. */
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
  ChatActiveStatusInfo,
  ChatActiveStatusProps,
  ChatComponentType,
  ChatActionsProps,
  ChatActionsRegion,
  ChatActivityItem,
  ChatActivityProps,
  ChatActivityRegion,
  ChatHoistedOutputProps,
  ChatCopyAction,
  ChatErrorProps,
  ChatErrorRegion,
  ChatForkAction,
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
