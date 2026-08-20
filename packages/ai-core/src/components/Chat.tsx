import type {ComponentProps, FC, PropsWithChildren} from 'react';
import {ChatMessagesContainer} from './ChatMessagesContainer';
import {
  LocalAgentChatRuntimeProvider,
  SessionChatRuntimeProvider,
  useChatRuntime,
  type LocalAgentChatRootProps,
} from './ChatRuntimeContext';
import {
  DropTarget as ComposerDropTarget,
  Input as ComposerInput,
  LocalAgentChatComposerProvider,
  Send as ComposerSend,
  SessionChatComposerProvider,
  Stop as ComposerStop,
} from './composer';
import {ChatRendering, type ChatRenderingProps} from './ChatRenderingContext';
import {
  type ToolRenderBehavior,
  ToolRenderBehaviorProvider,
} from './FlatAgentRenderer';
import {InlineApiKeyInput} from './InlineApiKeyInput';
import {LocalAgentChatComposer} from './LocalAgentChatComposer';
import {LocalAgentChatMessages} from './LocalAgentChatMessages';
import {
  LocalAgentPromptSuggestionItem,
  LocalAgentPromptSuggestionsContainer,
  LocalAgentPromptSuggestionsVisibilityToggle,
} from './LocalAgentPromptSuggestions';
import {ModelSelector} from './ModelSelector';
import {PromptSuggestions} from './PromptSuggestions';
import {QueryControls} from './QueryControls';
import {SessionControls} from './SessionControls';
import {ChatSearch, ChatSearchProvider} from './ChatSearch';
import {ContextSelector} from './context/ContextSelector';
import {ChatHeader} from './ChatHeader';
import {ChatHistoryView} from './ChatHistoryView';

type RootProps = PropsWithChildren<{
  toolRenderBehavior?: ToolRenderBehavior;
}>;

type ChatComponent = FC<RootProps> & {
  Root: FC<RootProps>;
  LocalAgentRoot: FC<LocalAgentChatRootProps>;
  /**
   * Subtree-scoped presentation recipe. Partial `components` overrides merge
   * with SQLRooms defaults (or a parent recipe).
   */
  Rendering: FC<ChatRenderingProps>;
  Sessions: typeof SessionControls;
  Header: typeof ChatHeader;
  History: typeof ChatHistoryView;
  Messages: FC<ComponentProps<typeof ChatMessagesContainer>>;
  Composer: FC<ComponentProps<typeof QueryControls>> & {
    Input: typeof ComposerInput;
    Send: typeof ComposerSend;
    Stop: typeof ComposerStop;
    DropTarget: typeof ComposerDropTarget;
  };
  InlineApiKeyInput: typeof InlineApiKeyInput;
  PromptSuggestions: typeof PromptSuggestions.Container & {
    Item: typeof PromptSuggestions.Item;
    VisibilityToggle: typeof PromptSuggestions.VisibilityToggle;
  };
  Search: typeof ChatSearch;
  ModelSelector: typeof ModelSelector;
  ContextSelector: typeof ContextSelector;
};

const EMPTY_BEHAVIOR: ToolRenderBehavior = {};

/**
 * Local compound component wrapper that provides session-mode chat context.
 */
const Root: FC<RootProps> = ({children, toolRenderBehavior}) => (
  <ToolRenderBehaviorProvider value={toolRenderBehavior ?? EMPTY_BEHAVIOR}>
    <SessionChatRuntimeProvider>
      <SessionChatComposerProvider>
        <ChatSearchProvider>{children}</ChatSearchProvider>
      </SessionChatComposerProvider>
    </SessionChatRuntimeProvider>
  </ToolRenderBehaviorProvider>
);

const LocalAgentRoot: FC<LocalAgentChatRootProps> = ({
  children,
  toolRenderBehavior,
  ...props
}) => (
  <ToolRenderBehaviorProvider value={toolRenderBehavior ?? EMPTY_BEHAVIOR}>
    <LocalAgentChatRuntimeProvider {...props}>
      <LocalAgentChatComposerProvider>
        {children}
      </LocalAgentChatComposerProvider>
    </LocalAgentChatRuntimeProvider>
  </ToolRenderBehaviorProvider>
);

const Messages: FC<ComponentProps<typeof ChatMessagesContainer>> = (props) => {
  const runtime = useChatRuntime();
  if (runtime.mode === 'local-agent') {
    return <LocalAgentChatMessages className={props.className} />;
  }
  return <ChatMessagesContainer {...props} />;
};

const ComposerRoot: FC<ComponentProps<typeof QueryControls>> = (props) => {
  const runtime = useChatRuntime();
  if (runtime.mode === 'local-agent') {
    return <LocalAgentChatComposer {...props} />;
  }
  return <QueryControls {...props} />;
};

const Composer = Object.assign(ComposerRoot, {
  Input: ComposerInput,
  Send: ComposerSend,
  Stop: ComposerStop,
  DropTarget: ComposerDropTarget,
});

const PromptSuggestionsContainer: typeof PromptSuggestions.Container = (
  props,
) => {
  const runtime = useChatRuntime();
  if (runtime.mode === 'local-agent') {
    return <LocalAgentPromptSuggestionsContainer {...props} />;
  }
  return <PromptSuggestions.Container {...props} />;
};

const PromptSuggestionsItem: typeof PromptSuggestions.Item = (props) => {
  const runtime = useChatRuntime();
  if (runtime.mode === 'local-agent') {
    return <LocalAgentPromptSuggestionItem {...props} />;
  }
  return <PromptSuggestions.Item {...props} />;
};

const PromptSuggestionsVisibilityToggle: typeof PromptSuggestions.VisibilityToggle =
  (props) => {
    const runtime = useChatRuntime();
    if (runtime.mode === 'local-agent') {
      return <LocalAgentPromptSuggestionsVisibilityToggle {...props} />;
    }
    return <PromptSuggestions.VisibilityToggle {...props} />;
  };

const PromptSuggestionsCompound = Object.assign(PromptSuggestionsContainer, {
  Item: PromptSuggestionsItem,
  VisibilityToggle: PromptSuggestionsVisibilityToggle,
});

export const Chat: ChatComponent = Object.assign(Root, {
  Root,
  LocalAgentRoot,
  Rendering: ChatRendering,
  Sessions: SessionControls,
  Header: ChatHeader,
  History: ChatHistoryView,
  Messages,
  Composer,
  InlineApiKeyInput: InlineApiKeyInput,
  PromptSuggestions: PromptSuggestionsCompound,
  Search: ChatSearch,
  ModelSelector: ModelSelector,
  ContextSelector: ContextSelector,
}) as ChatComponent;

export type {LocalAgentChatRootProps, ChatRenderingProps};
