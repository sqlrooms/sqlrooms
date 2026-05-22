import type {ComponentProps, FC, PropsWithChildren} from 'react';
import {AnalysisResultsContainer} from './AnalysisResultsContainer';
import {
  LocalAgentChatRuntimeProvider,
  SessionChatRuntimeProvider,
  useChatRuntime,
  type LocalAgentChatRootProps,
} from './ChatRuntimeContext';
import {ContextSelector} from './ContextSelector';
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
import {SessionChatManager} from './SessionChatManager';
import {SessionControls} from './SessionControls';
import {ChatSearch, ChatSearchProvider} from './ChatSearch';

type RootProps = PropsWithChildren<{
  toolRenderBehavior?: ToolRenderBehavior;
}>;

type ChatComponent = FC<RootProps> & {
  Root: FC<RootProps>;
  LocalAgentRoot: FC<LocalAgentChatRootProps>;
  Sessions: typeof SessionControls;
  Messages: FC<ComponentProps<typeof AnalysisResultsContainer>>;
  Composer: FC<ComponentProps<typeof QueryControls>>;
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
 * Local compound component wrapper to reduce the number of @sqlrooms/ai imports
 * and provide a single "root" place to mount SessionChatManager.
 */
const Root: FC<RootProps> = ({children, toolRenderBehavior}) => (
  <ToolRenderBehaviorProvider value={toolRenderBehavior ?? EMPTY_BEHAVIOR}>
    <SessionChatRuntimeProvider>
      <ChatSearchProvider>
        <SessionChatManager />
        {children}
      </ChatSearchProvider>
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
      {children}
    </LocalAgentChatRuntimeProvider>
  </ToolRenderBehaviorProvider>
);

const Messages: FC<ComponentProps<typeof AnalysisResultsContainer>> = (
  props,
) => {
  const runtime = useChatRuntime();
  if (runtime.mode === 'local-agent') {
    return <LocalAgentChatMessages className={props.className} />;
  }
  return <AnalysisResultsContainer {...props} />;
};

const Composer: FC<ComponentProps<typeof QueryControls>> = (props) => {
  const runtime = useChatRuntime();
  if (runtime.mode === 'local-agent') {
    return <LocalAgentChatComposer {...props} />;
  }
  return <QueryControls {...props} />;
};

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
  Sessions: SessionControls,
  Messages,
  Composer,
  InlineApiKeyInput: InlineApiKeyInput,
  PromptSuggestions: PromptSuggestionsCompound,
  Search: ChatSearch,
  ModelSelector: ModelSelector,
  ContextSelector: ContextSelector,
}) as ChatComponent;

export type {LocalAgentChatRootProps};
