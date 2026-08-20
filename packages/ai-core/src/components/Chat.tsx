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
import {
  LocalAgentChatSuggestionsProvider,
  SessionChatSuggestionsProvider,
} from './suggestions';
import {ChatRendering, type ChatRenderingProps} from './ChatRenderingContext';
import {
  type ToolRenderBehavior,
  ToolRenderBehaviorProvider,
} from './FlatAgentRenderer';
import {InlineApiKeyInput} from './InlineApiKeyInput';
import {LocalAgentChatMessages} from './LocalAgentChatMessages';
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
  PromptSuggestions: typeof PromptSuggestions;
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
        <SessionChatSuggestionsProvider>
          <ChatSearchProvider>{children}</ChatSearchProvider>
        </SessionChatSuggestionsProvider>
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
        <LocalAgentChatSuggestionsProvider>
          {children}
        </LocalAgentChatSuggestionsProvider>
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

// `QueryControls` itself now serves both runtime modes — it sources its
// state from `useChatComposer()`, which normalizes over session and
// local-agent mode, so no runtime-dispatch wrapper is needed here.
const Composer = Object.assign(QueryControls, {
  Input: ComposerInput,
  Send: ComposerSend,
  Stop: ComposerStop,
  DropTarget: ComposerDropTarget,
});

// `PromptSuggestions` itself now serves both runtime modes — it sources its
// state from `usePromptSuggestions()`, which normalizes over session and
// local-agent mode, so no runtime-dispatch wrapper is needed here.

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
  PromptSuggestions,
  Search: ChatSearch,
  ModelSelector: ModelSelector,
  ContextSelector: ContextSelector,
}) as ChatComponent;

export type {LocalAgentChatRootProps, ChatRenderingProps};
