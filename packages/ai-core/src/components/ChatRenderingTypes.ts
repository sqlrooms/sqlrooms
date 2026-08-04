import type {
  ComponentType,
  ExoticComponent,
  PropsWithChildren,
  ReactNode,
} from 'react';
import type {Components} from 'react-markdown';
import type {AgentToolCall} from '../types';
import type {ToolPartWithId} from './buildChatTurnModel';
import type {HoistableToolCall} from './collectHoistableRenderers';

/** Any React component type accepted by a chat rendering slot. */
export type ChatComponentType<TProps = object> =
  | ComponentType<TProps>
  | ExoticComponent<TProps>;

/** How nested agent activity is composed into turn-level activity. */
export type ChatNestedActivityMode = 'own-boxes' | 'embed';

/** Props for the user-prompt presentation slot. */
export type ChatPromptProps = {
  prompt: string;
  searchBlockId: string;
};

/** Props for activity chrome around reasoning and tool activity. */
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

/** Props for a reasoning disclosure slot. */
export type ChatReasoningProps = {
  text: string;
  isRunning: boolean;
  searchBlockId: string;
};

/** Props for an assistant text-output slot. */
export type ChatTextOutputProps = {
  text: string;
  index: number;
  /** True only when this text is the final source-order message part. */
  isAnswer: boolean;
  searchBlockId: string;
  customMarkdownComponents?: Partial<Components>;
};

/** Props for one tool or nested-agent activity slot. */
export type ChatToolActivityProps = {
  /** Normalized tool-call semantics, available for top-level and nested calls. */
  toolCall: AgentToolCall;
  /** Original AI SDK part when this activity came from the turn message. */
  part?: ToolPartWithId;
  /** Source-message index; absent for calls nested inside an agent. */
  index?: number;
  isAgent: boolean;
  /** True when this call's rich UI is rendered in a hoisted region. */
  isHoisted: boolean;
  /** Registered search block; absent for nested activity. */
  searchBlockId?: string;
};

/** Props for one rich tool output in a hoisted region. */
export type ChatHoistedOutputProps = {
  item: HoistableToolCall;
};

/** Props for turn error presentation. */
export type ChatErrorProps = {
  message: string;
};

/** Copy capability with its pre-wired default control. */
export type ChatCopyAction = {
  text: string;
  Content: ChatComponentType;
};

/** Fork capability with its pre-wired default control. */
export type ChatForkAction = {
  run: () => void;
  Content: ChatComponentType;
};

/** Available turn actions passed to an action layout recipe. */
export type ChatActionsProps = {
  copy?: ChatCopyAction;
  fork?: ChatForkAction;
};

/** Normalized state exposed for tool activity presentation. */
export type ChatToolState = AgentToolCall['state'];

/** Prompt semantics plus its pre-wired rendering component. */
export type ChatPromptRegion = {
  text: string;
  Content: ChatComponentType;
};

/** One semantic activity item with pre-wired leaf rendering. */
export type ChatActivityItem =
  | {
      id: string;
      kind: 'reasoning';
      text: string;
      Content: ChatComponentType;
    }
  | {
      id: string;
      kind: 'tool';
      toolName: string;
      state: ChatToolState;
      isAgent: boolean;
      isHoisted: boolean;
      Content: ChatComponentType;
    };

/** Activity semantics plus aggregated pre-wired rendering. */
export type ChatActivityRegion = {
  isRunning: boolean;
  toolCount: number;
  computationTimeMs?: number;
  items: readonly ChatActivityItem[];
  Content: ChatComponentType;
};

/** One assistant text item with pre-wired markdown rendering. */
export type ChatTextItem = {
  id: string;
  text: string;
  isAnswer: boolean;
  Content: ChatComponentType;
};

/** A response or summary text region. */
export type ChatTextRegion = {
  items: readonly ChatTextItem[];
  Content: ChatComponentType;
};

/** One hoisted tool output with pre-wired rich rendering. */
export type ChatOutputItem = {
  id: string;
  toolName: string;
  state: ChatToolState;
  Content: ChatComponentType;
};

/** Hoisted tool outputs for a turn. */
export type ChatOutputRegion = {
  items: readonly ChatOutputItem[];
  Content: ChatComponentType;
};

/** Available actions plus the pre-wired default action row. */
export type ChatActionsRegion = ChatActionsProps & {
  Content: ChatComponentType;
};

/** Turn error state plus its pre-wired presentation. */
export type ChatErrorRegion = {
  message: string;
  Content: ChatComponentType;
};

/** SQLRooms' pre-wired source-order body. */
export type ChatTimelineRegion = {
  Content: ChatComponentType;
};

/**
 * Semantic data and pre-wired rendering for one turn. Custom layouts may use
 * either level without rebuilding search ids, slot props, or hoist decisions.
 */
export type ChatTurnPresentation = {
  id: string;
  isCompleted: boolean;
  prompt: ChatPromptRegion;
  activity: ChatActivityRegion;
  response: ChatTextRegion;
  hoistedOutputs: ChatOutputRegion;
  summary: ChatTextRegion;
  error?: ChatErrorRegion;
  actions: ChatActionsRegion;
  timeline: ChatTimelineRegion;
};

/** Props for a full turn layout recipe. */
export type ChatTurnSlotProps = {
  turn: ChatTurnPresentation;
};

/** Component slots that define a chat presentation recipe. */
export type ChatRenderingComponents = {
  Turn: ChatComponentType<ChatTurnSlotProps>;
  Prompt: ChatComponentType<ChatPromptProps>;
  Activity: ChatComponentType<ChatActivityProps>;
  Reasoning: ChatComponentType<ChatReasoningProps>;
  TextOutput: ChatComponentType<ChatTextOutputProps>;
  ToolActivity: ChatComponentType<ChatToolActivityProps>;
  HoistedOutput: ChatComponentType<ChatHoistedOutputProps>;
  Error: ChatComponentType<ChatErrorProps>;
  Actions: ChatComponentType<ChatActionsProps>;
};

/** Resolved chat rendering recipe stored in context. */
export type ChatRenderingValue = {
  components: ChatRenderingComponents;
  nestedActivityMode: ChatNestedActivityMode;
};

/** Props for {@link ChatRendering}. */
export type ChatRenderingProps = PropsWithChildren<{
  /**
   * Partial presentation overrides. Missing slots inherit SQLRooms defaults
   * or the nearest parent recipe.
   */
  components?: Partial<ChatRenderingComponents>;
  /** Controls whether nested agents own activity boxes or embed in the turn. */
  nestedActivityMode?: ChatNestedActivityMode;
}>;
