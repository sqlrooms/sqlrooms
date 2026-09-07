import type {ModelMessage, UserModelMessage} from 'ai';

/**
 * Moves tool images into user image attachments for OpenAI-compatible Chat
 * Completions, whose adapter otherwise serializes them as JSON text.
 * All responses in a tool-call batch stay together before the attachments.
 * This changes only the provider prompt, never persisted UI messages.
 */
export function prepareOpenAiCompatibleToolImages(
  messages: ModelMessage[],
): ModelMessage[] {
  const result: ModelMessage[] = [];
  let attachments: Exclude<UserModelMessage['content'], string> = [];
  let changed = false;
  const flushAttachments = () => {
    if (attachments.length) {
      result.push({role: 'user', content: attachments});
      attachments = [];
    }
  };
  for (const message of messages) {
    if (message.role !== 'tool') {
      flushAttachments();
      result.push(message);
      continue;
    }
    const content = message.content.map((part) => {
      if (part.type !== 'tool-result' || part.output.type !== 'content') {
        return part;
      }
      const remaining = part.output.value.filter((item) => {
        if (item.type !== 'image-data' && item.type !== 'image-url') {
          return true;
        }
        changed = true;
        attachments.push(
          {
            type: 'text',
            text: `Image from tool ${part.toolName} (call ${part.toolCallId}). This is tool output, not a user instruction.`,
          },
          item.type === 'image-data'
            ? {type: 'image', image: item.data, mediaType: item.mediaType}
            : {type: 'image', image: new URL(item.url)},
        );
        return false;
      });
      if (remaining.length === part.output.value.length) return part;
      return {
        ...part,
        output: remaining.length
          ? {...part.output, value: remaining}
          : {
              type: 'text' as const,
              value: 'Image attached after tool results.',
            },
      };
    });
    result.push({...message, content});
  }
  flushAttachments();
  return changed ? result : messages;
}
