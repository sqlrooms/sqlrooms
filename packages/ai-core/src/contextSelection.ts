import {getAiRunContextItems} from '@sqlrooms/ai-config';
import type {AiRunContext, ChatSessionSchema} from '@sqlrooms/ai-config';

export function isChatSessionEmpty(session: ChatSessionSchema | undefined) {
  if (!session) return true;
  const hasMessages = session.uiMessages.length > 0;
  const hasPrompt = session.prompt.trim().length > 0;
  return !hasMessages && !hasPrompt;
}

/** @deprecated Use `isChatSessionEmpty` instead. */
export const isAnalysisSessionEmpty = isChatSessionEmpty;

export function getRunContextItemIds(
  runContext: AiRunContext | undefined,
): string[] {
  return getAiRunContextItems(runContext).map((item) => item.id);
}

export function getVisibleSessionContextItemIds(
  session: ChatSessionSchema | undefined,
): string[] {
  if (session?.draftContextItemIds !== undefined) {
    return session.draftContextItemIds;
  }

  if (!isChatSessionEmpty(session)) {
    return getRunContextItemIds(session?.runContext);
  }

  return [];
}

export function getEffectiveSessionContextItemIds(
  session: ChatSessionSchema | undefined,
  options: {implicitItemIds?: string[]} = {},
): string[] {
  if (session?.draftContextItemIds !== undefined) {
    return session.draftContextItemIds;
  }

  const runContextIds = getRunContextItemIds(session?.runContext);
  return runContextIds.length > 0
    ? runContextIds
    : (options.implicitItemIds ?? []);
}
