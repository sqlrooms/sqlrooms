import type {UIMessage} from 'ai';

/**
 * Filters out data-tool-additional-output parts from UIMessages.
 * These parts are used to send additional tool data to the client via onData callback,
 * but should not be included in the conversation history.
 *
 * @param messages - Array of UIMessages to filter
 * @returns Filtered array with data-tool-additional-output parts removed
 */
export function filterDataParts(messages: UIMessage[]): UIMessage[] {
  return messages.map((msg) => {
    if (msg.parts) {
      const filteredParts = msg.parts.filter(
        (part: any) => part.type !== 'data-tool-additional-output',
      );
      return {...msg, parts: filteredParts};
    }
    return msg;
  });
}

/**
 * Filters out data-tool-additional-output parts from a single UIMessage.
 *
 * @param message - UIMessage to filter
 * @returns Filtered message with data-tool-additional-output parts removed
 */
export function filterDataPartsFromMessage(message: UIMessage): UIMessage {
  if (message.parts) {
    const filteredParts = message.parts.filter(
      (part: any) => part.type !== 'data-tool-additional-output',
    );
    return {...message, parts: filteredParts};
  }
  return message;
}
