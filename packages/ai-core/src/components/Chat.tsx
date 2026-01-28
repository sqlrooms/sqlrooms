import type {FC, PropsWithChildren} from 'react';
import {AnalysisResultsContainer} from './AnalysisResultsContainer';
import {PromptSuggestions} from './PromptSuggestions';
import {QueryControls} from './QueryControls';
import {SessionChatManager} from './SessionChatManager';
import {SessionControls} from './SessionControls';
import {ModelSelector} from './ModelSelector';

type ChatComponent = FC<PropsWithChildren> & {
  Root: FC<PropsWithChildren>;
  Sessions: typeof SessionControls;
  Messages: typeof AnalysisResultsContainer;
  Composer: typeof QueryControls;
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
const Root: FC<PropsWithChildren> = ({children}) => (
  <>
    <SessionChatManager />
    {children}
  </>
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
  PromptSuggestions: PromptSuggestionsCompound,
  ModelSelector: ModelSelector,
}) as ChatComponent;
