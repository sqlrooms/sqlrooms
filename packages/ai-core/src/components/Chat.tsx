import type {FC, PropsWithChildren} from 'react';
import {AnalysisResultsContainer} from './AnalysisResultsContainer';
import {
  type ToolRenderBehavior,
  ToolRenderBehaviorProvider,
} from './FlatAgentRenderer';
import {InlineApiKeyInput} from './InlineApiKeyInput';
import {ModelSelector} from './ModelSelector';
import {PromptSuggestions} from './PromptSuggestions';
import {QueryControls} from './QueryControls';
import {SessionChatManager} from './SessionChatManager';
import {SessionControls} from './SessionControls';

type RootProps = PropsWithChildren<{
  toolRenderBehavior?: ToolRenderBehavior;
}>;

type ChatComponent = FC<RootProps> & {
  Root: FC<RootProps>;
  Sessions: typeof SessionControls;
  Messages: typeof AnalysisResultsContainer;
  Composer: typeof QueryControls;
  InlineApiKeyInput: typeof InlineApiKeyInput;
  PromptSuggestions: typeof PromptSuggestions.Container & {
    Item: typeof PromptSuggestions.Item;
    VisibilityToggle: typeof PromptSuggestions.VisibilityToggle;
  };
  ModelSelector: typeof ModelSelector;
};

/**
 * Local compound component wrapper to reduce the number of @sqlrooms/ai imports
 * and provide a single "root" place to mount SessionChatManager.
 */
const Root: FC<RootProps> = ({children, toolRenderBehavior = {}}) => (
  <ToolRenderBehaviorProvider value={toolRenderBehavior}>
    <SessionChatManager />
    {children}
  </ToolRenderBehaviorProvider>
);

const PromptSuggestionsCompound = Object.assign(PromptSuggestions.Container, {
  Item: PromptSuggestions.Item,
  VisibilityToggle: PromptSuggestions.VisibilityToggle,
});

export const Chat: ChatComponent = Object.assign(Root, {
  Root,
  Sessions: SessionControls,
  Messages: AnalysisResultsContainer,
  Composer: QueryControls,
  InlineApiKeyInput: InlineApiKeyInput,
  PromptSuggestions: PromptSuggestionsCompound,
  ModelSelector: ModelSelector,
}) as ChatComponent;
