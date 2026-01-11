import type {FC, PropsWithChildren} from 'react';
import {AnalysisResultsContainer} from './AnalysisResultsContainer';
import {QueryControls} from './QueryControls';
import {SessionChatManager} from './SessionChatManager';
import {SessionControls} from './SessionControls';

type ChatContainerComponent = FC<PropsWithChildren> & {
  Root: FC<PropsWithChildren>;
  SessionControls: typeof SessionControls;
  AnalysisResultsContainer: typeof AnalysisResultsContainer;
  QueryControls: typeof QueryControls;
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

export const ChatContainer: ChatContainerComponent = Object.assign(Root, {
  Root,
  SessionControls,
  AnalysisResultsContainer,
  QueryControls,
}) as ChatContainerComponent;
