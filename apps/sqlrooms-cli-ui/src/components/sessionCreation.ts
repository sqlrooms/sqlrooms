import {isChatSessionEmpty, type ChatSessionSchema} from '@sqlrooms/ai';
import {isDefaultAssistantSessionName} from './useGenSessionTitle';

/** Returns whether creating another chat would duplicate the default empty chat. */
export function isCreateSessionDisabled(
  currentSession: ChatSessionSchema | undefined,
): boolean {
  return Boolean(
    currentSession &&
    isChatSessionEmpty(currentSession) &&
    isDefaultAssistantSessionName(currentSession.name),
  );
}
