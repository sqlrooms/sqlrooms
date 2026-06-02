import {AiSliceConfig} from '@sqlrooms/ai';
import type {JsonObject} from '#/lib/json';

export function parseWorkspaceAiConfig(aiConfig: JsonObject) {
  return AiSliceConfig.parse(aiConfig);
}

export function getAiConfigSyncKey(aiConfig: unknown) {
  const parsedConfig = AiSliceConfig.safeParse(aiConfig);
  if (!parsedConfig.success) return JSON.stringify(aiConfig);

  return JSON.stringify({
    ...parsedConfig.data,
    sessions: parsedConfig.data.sessions.map((session) => ({
      ...session,
      prompt: '',
    })),
  });
}

export function createAssistantChatHeaders(
  token: string | null,
): Record<string, string> {
  return token ? {Authorization: `Bearer ${token}`} : {};
}

export function createAssistantInstructions(runContext: unknown) {
  const context =
    runContext && typeof runContext === 'object' && 'items' in runContext
      ? (runContext as {
          items?: Array<{kind?: string; id?: string; title?: string}>;
        })
      : undefined;
  const worksheet = context?.items?.find((item) => item.kind === 'worksheet');

  return `You are the SQLRooms assistant for a browser-based data analysis workspace.
Help the user reason about datasets, write SQL, plan worksheets, and design charts or dashboards.
Be concise, practical, and explicit about assumptions. Do not claim to inspect data unless the user has provided it in the chat.

Primary worksheet: ${worksheet?.title ?? 'Unknown worksheet'}`;
}
