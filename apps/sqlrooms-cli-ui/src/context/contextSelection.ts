import {
  getAiRunContextItems,
  type AiRunContext,
  type AnalysisSessionSchema,
} from '@sqlrooms/ai';

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

export function getAssistantSessionContextItemIds({
  session,
}: {
  session: AnalysisSessionSchema | undefined;
}): string[] {
  if (session?.draftContextItemIds) {
    return session.draftContextItemIds;
  }

  if (!isAnalysisSessionEmpty(session)) {
    return getRunContextItemIds(session?.runContext);
  }

  return [];
}

export function getEffectiveContextItemIds({
  session,
  currentArtifactId,
}: {
  session: AnalysisSessionSchema | undefined;
  currentArtifactId: string | undefined;
}): string[] {
  if (session?.draftContextItemIds) {
    return session.draftContextItemIds.length > 0
      ? session.draftContextItemIds
      : currentArtifactId
        ? [currentArtifactId]
        : [];
  }

  const runContextIds = getRunContextItemIds(session?.runContext);
  return runContextIds.length > 0
    ? runContextIds
    : currentArtifactId
      ? [currentArtifactId]
      : [];
}
