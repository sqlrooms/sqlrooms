import React, {
  createContext,
  useContext,
  useMemo,
  type ComponentType,
  type FC,
  type PropsWithChildren,
  type ReactNode,
} from 'react';
import type {Components} from 'react-markdown';
import type {ChatTurn} from '../chatTurns';
import type {ErrorMessageComponentProps} from './ErrorMessage';
import type {
  ChatTurnModel,
  ChatTurnTextItem,
  ToolPartWithId,
} from './buildChatTurnModel';
import type {HoistableToolCall} from './collectHoistableRenderers';

/**
 * How nested agent activity should present Activity boxes.
 * - `own-boxes`: each tool-group owns an ActivityBox (SQLRooms default).
 * - `embed`: leaf log lines embed into the parent turn Activity (app recipes).
 */
export type ChatNestedActivityMode = 'own-boxes' | 'embed';

export type ChatPromptProps = {
  prompt: string;
  searchBlockId: string;
  children?: ReactNode;
};

export type ChatActivityProps = {
  children: ReactNode;
  isRunning: boolean;
  isCompleted: boolean;
  toolCount: number;
  /** Presentation-ready summary, e.g. "Worked with 4 tools". */
  summaryLabel?: string;
  /** Aggregated tool runtime in milliseconds, when available. */
  computationTimeMs?: number;
  /** Presentation-ready timing label, e.g. "Computation Time: 12.4 s". */
  computationTimeLabel?: string;
  className?: string;
};

export type ChatReasoningProps = {
  text: string;
  isRunning: boolean;
  searchBlockId: string;
  children?: ReactNode;
};

export type ChatTextOutputProps = {
  text: string;
  index: number;
  isAnswer: boolean;
  searchBlockId: string;
  customMarkdownComponents?: Partial<Components>;
};

export type ChatToolActivityProps = {
  part: ToolPartWithId;
  index: number;
  isAgent: boolean;
  /** True when this call's rich UI is rendered in the hoisted region. */
  isHoisted: boolean;
  searchBlockId: string;
};

export type ChatHoistedOutputProps = {
  item: HoistableToolCall;
};

export type ChatActionsProps = {
  hasTextContent: boolean;
  allTextContent: string;
  canFork: boolean;
  onFork?: () => void;
  errorMessage?: string;
  ErrorMessageComponent?: ComponentType<ErrorMessageComponentProps>;
};

/**
 * Props for a full turn layout recipe. Apps that need a different regional
 * order (e.g. activity → response → hoisted → summary) override `Turn`.
 */
export type ChatTurnSlotProps = {
  chatTurn?: ChatTurn;
  model: ChatTurnModel;
  prompt: string;
  turnId: string;
  isCompleted: boolean;
  searchBlockPrefix: string;
  /** Tool names the host asked to hoist into the turn body. */
  hoistableToolNames: ReadonlySet<string>;
  customMarkdownComponents?: Partial<Components>;
  ErrorMessageComponent?: ComponentType<ErrorMessageComponentProps>;
  canFork: boolean;
  onFork?: () => void;
  allTextContent: string;
  hasTextContent: boolean;
  errorMessage?: string;
  activitySummaryLabel?: string;
  computationTimeMs?: number;
  computationTimeLabel?: string;
  /** Convenience projection used by chronological recipes. */
  responseText: ChatTurnTextItem[];
  summaryText: ChatTurnTextItem[];
  /** Resolved (merged) slot components for composing sub-regions. */
  components: ChatRenderingComponents;
};

export type ChatRenderingComponents = {
  Turn: ComponentType<ChatTurnSlotProps>;
  Prompt: ComponentType<ChatPromptProps>;
  Activity: ComponentType<ChatActivityProps>;
  Reasoning: ComponentType<ChatReasoningProps>;
  TextOutput: ComponentType<ChatTextOutputProps>;
  ToolActivity: ComponentType<ChatToolActivityProps>;
  HoistedOutput: ComponentType<ChatHoistedOutputProps>;
  Actions: ComponentType<ChatActionsProps>;
};

export type ChatRenderingValue = {
  components: ChatRenderingComponents;
  nestedActivityMode: ChatNestedActivityMode;
};

const ChatRenderingContext = createContext<ChatRenderingValue | null>(null);

let defaultComponentsRef: ChatRenderingComponents | null = null;

/** Lazy default binder so defaults can live in a sibling module. */
export function bindDefaultChatRenderingComponents(
  components: ChatRenderingComponents,
): void {
  defaultComponentsRef = components;
}

function getDefaultComponents(): ChatRenderingComponents {
  if (!defaultComponentsRef) {
    throw new Error(
      'Chat rendering defaults are not bound. Import ChatTurnView / Chat before using Chat.Rendering.',
    );
  }
  return defaultComponentsRef;
}

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

export type ChatRenderingProps = PropsWithChildren<{
  /**
   * Partial presentation overrides. Missing slots inherit SQLRooms defaults
   * (or the nearest parent `Chat.Rendering` recipe).
   */
  components?: Partial<ChatRenderingComponents>;
  /**
   * Nested agent Activity presentation. Defaults to `own-boxes` for the
   * SQLRooms recipe and is typically set to `embed` by chronological recipes.
   */
  nestedActivityMode?: ChatNestedActivityMode;
}>;

/**
 * Subtree-scoped chat presentation recipe. Partial overrides merge with the
 * parent recipe (or SQLRooms defaults at the root).
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
  const parent = useContext(ChatRenderingContext);
  const value = useMemo<ChatRenderingValue>(() => {
    const baseComponents = parent?.components ?? getDefaultComponents();
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
  const ctx = useContext(ChatRenderingContext);
  if (ctx) return ctx;
  return {
    components: getDefaultComponents(),
    nestedActivityMode: 'own-boxes',
  };
}

export function useChatRenderingComponents(): ChatRenderingComponents {
  const ctx = useContext(ChatRenderingContext);
  return ctx?.components ?? getDefaultComponents();
}

export function useChatNestedActivityMode(): ChatNestedActivityMode {
  const ctx = useContext(ChatRenderingContext);
  return ctx?.nestedActivityMode ?? 'own-boxes';
}
