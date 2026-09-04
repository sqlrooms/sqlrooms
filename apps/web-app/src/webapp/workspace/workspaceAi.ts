import {AiSliceConfig} from '@sqlrooms/ai';
import type {JsonObject} from '#/lib/json';
import {getPrimaryDocumentRunContextItem} from '../assistant/documentRunContext';

export function parseWorkspaceAiConfig(aiConfig: JsonObject) {
  const parsedConfig = AiSliceConfig.safeParse(aiConfig);
  return parsedConfig.success
    ? parsedConfig.data
    : AiSliceConfig.parse({sessions: [], openSessionTabs: []});
}

export function isWorkspaceAiConfig(aiConfig: unknown): aiConfig is JsonObject {
  return AiSliceConfig.safeParse(aiConfig).success;
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
  const document = getPrimaryDocumentRunContextItem(runContext);

  return `You are the SQLRooms assistant for a browser-based data analysis workspace.
Help the user reason about datasets, write SQL, plan documents, and design charts or dashboards.
Be concise, practical, and explicit about assumptions. Do not claim to inspect data unless the user has provided it in the chat.

Primary document: ${document?.title ?? 'Unknown document'}`;
}
