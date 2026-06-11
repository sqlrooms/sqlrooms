import {getAiRunContextItems} from '@sqlrooms/ai-config';
import type {AiRunContext, AnalysisSessionSchema} from '@sqlrooms/ai-config';

export function isAnalysisSessionEmpty(
  session: AnalysisSessionSchema | undefined,
) {
  if (!session) return true;
  const hasMessages = session.uiMessages.length > 0;
  const hasCompletedResults = session.analysisResults.some(
    (result) => result.id !== '__pending__',
  );
  return !hasMessages && !hasCompletedResults;
}

export function getRunContextItemIds(
  runContext: AiRunContext | undefined,
): string[] {
  return getAiRunContextItems(runContext).map((item) => item.id);
}

export function getVisibleSessionContextItemIds(
  session: AnalysisSessionSchema | undefined,
): string[] {
  if (session?.draftContextItemIds !== undefined) {
    return session.draftContextItemIds;
  }

  if (!isAnalysisSessionEmpty(session)) {
    return getRunContextItemIds(session?.runContext);
  }

  return [];
}

export function getEffectiveSessionContextItemIds(
  session: AnalysisSessionSchema | undefined,
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
