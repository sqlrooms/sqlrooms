import type {FC, PropsWithChildren} from 'react';
import {AnalysisResultsContainer} from './AnalysisResultsContainer';
import {QueryControls} from './QueryControls';
import {SessionChatManager} from './SessionChatManager';
import {SessionControls} from './SessionControls';

type ChatComponent = FC<PropsWithChildren> & {
  Root: FC<PropsWithChildren>;
  Sessions: typeof SessionControls;
  Messages: typeof AnalysisResultsContainer;
  Composer: typeof QueryControls;
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

export const Chat: ChatComponent = Object.assign(Root, {
  Root,
  Sessions: SessionControls,
  Messages: AnalysisResultsContainer,
  Composer: QueryControls,
}) as ChatComponent;
