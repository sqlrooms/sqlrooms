import type {
  ComponentType,
  ExoticComponent,
  PropsWithChildren,
  ReactNode,
} from 'react';
import type {Components} from 'react-markdown';
import type {ErrorMessageComponentProps} from './ErrorMessage';
import type {ToolPartWithId} from './buildChatTurnModel';
import type {HoistableToolCall} from './collectHoistableRenderers';

type ChatComponentType<TProps = object> =
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
  isAnswer: boolean;
  searchBlockId: string;
  customMarkdownComponents?: Partial<Components>;
};

/** Props for one tool or nested-agent activity slot. */
export type ChatToolActivityProps = {
  part: ToolPartWithId;
  index: number;
  isAgent: boolean;
  /** True when this call's rich UI is rendered in a hoisted region. */
  isHoisted: boolean;
  searchBlockId: string;
};

/** Props for one rich tool output in a hoisted region. */
export type ChatHoistedOutputProps = {
  item: HoistableToolCall;
};

/** Props for turn-level actions and error presentation. */
export type ChatActionsProps = {
  hasTextContent: boolean;
  allTextContent: string;
  canFork: boolean;
  onFork?: () => void;
  errorMessage?: string;
  ErrorMessageComponent?: ChatComponentType<ErrorMessageComponentProps>;
};

/**
 * Small, presentation-oriented summary available to a custom turn layout.
 * Detailed rendering data stays owned by SQLRooms and is exposed through the
 * pre-wired {@link ChatTurnRegions}.
 */
export type ChatTurnPresentation = {
  id: string;
  isCompleted: boolean;
  hasPrompt: boolean;
  hasActivity: boolean;
  hasResponse: boolean;
  hasSummary: boolean;
  hoistedOutputCount: number;
  activity: {
    isRunning: boolean;
    toolCount: number;
    summaryLabel?: string;
    computationTimeMs?: number;
    computationTimeLabel?: string;
  };
};

/**
 * Pre-wired turn regions. A custom `Turn` may reorder or omit these components
 * without rebuilding slot props, search ids, or hoisting decisions.
 */
export type ChatTurnRegions = {
  Prompt: ChatComponentType;
  /** SQLRooms' source-order body used by the default turn recipe. */
  Timeline: ChatComponentType;
  /** Aggregated reasoning and tool activity for custom regional layouts. */
  Activity: ChatComponentType;
  Response: ChatComponentType;
  HoistedOutputs: ChatComponentType;
  Summary: ChatComponentType;
  Actions: ChatComponentType;
};

/** Props for a full turn layout recipe. */
export type ChatTurnSlotProps = {
  turn: ChatTurnPresentation;
  regions: ChatTurnRegions;
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
