import {useMemo} from 'react';
import type {UIMessagePartSchema, UIMessageSchema} from '@sqlrooms/ai-config';

/**
 * Custom hook to extract assistant message parts for a given analysis result ID.
 * Handles the case where the analysis result ID matches a user message and finds
 * the corresponding assistant response. Also includes fallback logic for pending
 * results before the real ID is assigned (e.g., during streaming).
 *
 * @param uiMessages - Array of UI messages from the current session
 * @param analysisResultId - The ID of the analysis result (user message ID)
 * @returns Array of message parts from the assistant's response, or empty array if not found
 */
export function useAssistantMessageParts(
  uiMessages: UIMessageSchema[] | undefined,
  analysisResultId: string,
): UIMessagePartSchema[] {
  return useMemo(() => {
    if (!uiMessages) return [];

    // Find the user message with analysisResultId
    let userMessageIndex = uiMessages.findIndex(
      (msg) => msg.id === analysisResultId && msg.role === 'user',
    );

    // If not found (e.g., pending result before onFinish assigns the real ID),
    // fall back to the last user message to enable streaming display.
    if (userMessageIndex === -1) {
      for (let i = uiMessages.length - 1; i >= 0; i--) {
        if (uiMessages[i]?.role === 'user') {
          userMessageIndex = i;
          break;
        }
      }
      if (userMessageIndex === -1) return [];
    }

    // Find the next assistant message after this user message
    for (let i = userMessageIndex + 1; i < uiMessages.length; i++) {
      const msg = uiMessages[i];
      if (msg?.role === 'assistant') {
        return msg.parts;
      }
      if (msg?.role === 'user') {
        // Hit next user message without finding assistant response
        break;
      }
    }
    return [];
  }, [uiMessages, analysisResultId]);
}
